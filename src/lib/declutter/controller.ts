import type { Map as MlMap } from 'maplibre-gl';
import { Simulation } from './simulation';
import { cullToBBox } from './data';
import { colorForCategory } from './palette';
import type { Anchor, Place, RenderSource, SimConfig } from './types';
import { DEFAULT_CONFIG } from './types';

export class DeclutterController {
  private map: MlMap;
  private places: Place[];
  private cfg: SimConfig;
  private sim: Simulation;
  private byId = new Map<number, Place>();
  private colorById = new Map<number, [number, number, number]>();
  private active: Place[] = [];
  private rafId = 0;
  private mapMoving = false;
  private prevZoomLevel = -1;
  private gated = false;
  private onStatus?: (text: string) => void;
  readonly source: RenderSource;

  constructor(
    map: MlMap,
    places: Place[],
    cfg: SimConfig = DEFAULT_CONFIG,
    onStatus?: (text: string) => void,
  ) {
    this.map = map;
    this.places = places;
    this.cfg = cfg;
    this.onStatus = onStatus;
    this.sim = new Simulation(cfg);
    for (const p of places) {
      this.byId.set(p.id, p);
      this.colorById.set(p.id, colorForCategory(p.category));
    }
    this.source = {
      pinVerts: new Float32Array(0),
      pinVertCount: 0,
      lineVerts: new Float32Array(0),
      lineVertCount: 0,
    };

    this.onMove = this.onMove.bind(this);
    this.loop = this.loop.bind(this);
    map.on('movestart', () => { this.mapMoving = true; });
    map.on('moveend', () => { this.mapMoving = false; this.kick(); });
    map.on('move', this.onMove);
    this.onMove();
  }

  private viewportBBox() {
    const b = this.map.getBounds();
    const margin = 0.05;
    const dLng = (b.getEast() - b.getWest()) * margin;
    const dLat = (b.getNorth() - b.getSouth()) * margin;
    return {
      minLng: b.getWest() - dLng,
      minLat: b.getSouth() - dLat,
      maxLng: b.getEast() + dLng,
      maxLat: b.getNorth() + dLat,
    };
  }

  private onMove(): void {
    this.active = cullToBBox(this.places, this.viewportBBox());
    this.gated = this.active.length > this.cfg.simMaxPins;
    this.updateStatus();
    const zoomLevel = Math.floor(this.map.getZoom());
    const reset = zoomLevel !== this.prevZoomLevel;
    if (reset) this.prevZoomLevel = zoomLevel;
    this.sim.setAnchors(this.projectAnchors(), reset);
    this.kick();
  }

  private updateStatus(): void {
    if (!this.onStatus) return;
    const total = this.places.length.toLocaleString();
    this.onStatus(
      this.gated ? `${total} places · zoom in to declutter` : `${total} places`,
    );
  }

  private projectAnchors(): Anchor[] {
    const anchors: Anchor[] = new Array(this.active.length);
    for (let i = 0; i < this.active.length; i++) {
      const p = this.active[i];
      const pt = this.map.project([p.lng, p.lat]);
      anchors[i] = { id: p.id, x: pt.x, y: pt.y };
    }
    return anchors;
  }

  private kick(): void {
    if (this.rafId === 0) this.rafId = requestAnimationFrame(this.loop);
  }

  private loop(): void {
    if (this.mapMoving) {
      this.sim.setAnchors(this.projectAnchors());
    }

    let moving = false;
    if (this.gated) {
      // Too many pins in view to declutter meaningfully — collapse onto
      // anchors and render a static point cloud instead of running physics.
      this.sim.snapToAnchors();
    } else {
      // Run as many ticks as fit in an 8ms budget so convergence is fast
      // without blocking the render thread.
      const deadline = performance.now() + 8;
      do {
        moving = this.sim.tick();
      } while (moving && !this.mapMoving && performance.now() < deadline);
    }

    this.buildBuffers();
    this.map.triggerRepaint();

    if (moving || this.mapMoving) {
      this.rafId = requestAnimationFrame(this.loop);
    } else {
      this.rafId = 0;
    }
  }

  private buildBuffers(): void {
    const pins = this.sim.getPins();
    const n = pins.length;
    if (this.source.pinVerts.length < n * 6 * 7) {
      this.source.pinVerts = new Float32Array(n * 6 * 7);
      this.source.lineVerts = new Float32Array(n * 2 * 5);
    }
    const pv = this.source.pinVerts;
    const lv = this.source.lineVerts;
    let pi = 0;
    let li = 0;
    const hide = this.cfg.leaderHideThreshold;

    // Clamp rendered displacement by zoom so leader lines stay short at country
    // zoom and only elongate as you zoom into a city.
    const zoom = this.map.getZoom();
    const maxDisp = Math.pow(2, zoom - 6) * 30;

    const corners: [number, number][] = [
      [-1, -1], [1, -1], [1, 1],
      [-1, -1], [1, 1], [-1, 1],
    ];

    for (const p of pins) {
      const [r, g, b] = this.colorById.get(p.id) ?? [1, 1, 1];
      const rad = p.radius;

      // Render position: simulation displacement capped to maxDisp.
      let rx = p.dx, ry = p.dy;
      const dd = Math.hypot(p.dx - p.x, p.dy - p.y);
      if (dd > maxDisp) {
        rx = p.x + (p.dx - p.x) / dd * maxDisp;
        ry = p.y + (p.dy - p.y) / dd * maxDisp;
      }

      for (const [lx, ly] of corners) {
        pv[pi++] = rx + lx * rad;
        pv[pi++] = ry + ly * rad;
        pv[pi++] = lx;
        pv[pi++] = ly;
        pv[pi++] = r;
        pv[pi++] = g;
        pv[pi++] = b;
      }
      const disp = Math.hypot(rx - p.x, ry - p.y);
      if (disp > hide) {
        lv[li++] = p.x; lv[li++] = p.y; lv[li++] = 0; lv[li++] = 0; lv[li++] = 0;
        lv[li++] = rx;  lv[li++] = ry;  lv[li++] = 0; lv[li++] = 0; lv[li++] = 0;
      }
    }
    this.source.pinVertCount = n * 6;
    this.source.lineVertCount = li / 5;
  }

  pick(px: number, py: number): Place | null {
    const id = this.sim.pick(px, py);
    return id === null ? null : this.byId.get(id) ?? null;
  }
}
