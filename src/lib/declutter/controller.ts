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
  readonly source: RenderSource;

  constructor(map: MlMap, places: Place[], cfg: SimConfig = DEFAULT_CONFIG) {
    this.map = map;
    this.places = places;
    this.cfg = cfg;
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
    this.sim.setAnchors(this.projectAnchors());
    this.kick();
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
    const moving = this.sim.tick();
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

    const corners: [number, number][] = [
      [-1, -1], [1, -1], [1, 1],
      [-1, -1], [1, 1], [-1, 1],
    ];

    for (const p of pins) {
      const [r, g, b] = this.colorById.get(p.id) ?? [1, 1, 1];
      const rad = p.radius;
      for (const [lx, ly] of corners) {
        pv[pi++] = p.dx + lx * rad;
        pv[pi++] = p.dy + ly * rad;
        pv[pi++] = lx;
        pv[pi++] = ly;
        pv[pi++] = r;
        pv[pi++] = g;
        pv[pi++] = b;
      }
      const disp = Math.hypot(p.dx - p.x, p.dy - p.y);
      if (disp > hide) {
        lv[li++] = p.x;  lv[li++] = p.y;  lv[li++] = r; lv[li++] = g; lv[li++] = b;
        lv[li++] = p.dx; lv[li++] = p.dy; lv[li++] = r; lv[li++] = g; lv[li++] = b;
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
