import { quadtree } from 'd3-quadtree';
import type { Anchor, SimConfig, SimPin } from './types';
import { crowdingFactor, radiusForCrowding, permittedOverlap } from './crowding';
import { visitWithin, visitWithinXY } from './quadtree';

export class Simulation {
  private cfg: SimConfig;
  private pins = new Map<number, SimPin>();
  private list: SimPin[] = [];

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
  }

  setAnchors(anchors: Anchor[], reset = false): void {
    const seen = new Set<number>();
    for (const a of anchors) {
      seen.add(a.id);
      const existing = this.pins.get(a.id);
      if (existing && !reset) {
        const ddx = a.x - existing.x;
        const ddy = a.y - existing.y;
        existing.x = a.x;
        existing.y = a.y;
        existing.dx += ddx;
        existing.dy += ddy;
        existing.vx = 0;
        existing.vy = 0;
      } else if (existing && reset) {
        existing.x = a.x;
        existing.y = a.y;
        const theta = (a.id * 2.399963229) % (2 * Math.PI);
        existing.dx = a.x + Math.cos(theta);
        existing.dy = a.y + Math.sin(theta);
        existing.vx = 0;
        existing.vy = 0;
      } else {
        const theta = (a.id * 2.399963229) % (2 * Math.PI);
        this.pins.set(a.id, {
          id: a.id,
          x: a.x,
          y: a.y,
          dx: a.x + Math.cos(theta),
          dy: a.y + Math.sin(theta),
          vx: 0,
          vy: 0,
          radius: this.cfg.maxRadius,
          overlap: 0,
        });
      }
    }
    for (const id of [...this.pins.keys()]) {
      if (!seen.has(id)) this.pins.delete(id);
    }
    this.list = [...this.pins.values()];
  }

  getPins(): SimPin[] {
    return this.list;
  }

  /** Collapse every pin onto its anchor with no velocity — used when the
   * in-view count exceeds simMaxPins and decluttering is skipped. Returns
   * false so the render loop can idle instead of churning. */
  snapToAnchors(): boolean {
    for (const p of this.list) {
      p.dx = p.x;
      p.dy = p.y;
      p.vx = 0;
      p.vy = 0;
      p.radius = this.cfg.maxRadius;
    }
    return false;
  }

  tick(): boolean {
    const pins = this.list;
    if (pins.length === 0) return false;
    const cfg = this.cfg;

    // 1. Density → radius + permitted overlap.
    // Measured on anchor positions so crowding reflects geographic density,
    // not how far relaxation has spread the displaced pins.
    const anchorTree = quadtree<SimPin>().x((p) => p.x).y((p) => p.y).addAll(pins);
    for (const p of pins) {
      let count = 0;
      visitWithinXY(anchorTree, p.x, p.y, cfg.neighborRadius, (q) => {
        if (q !== p) count++;
      });
      const c = crowdingFactor(count, cfg);
      p.radius = radiusForCrowding(c, cfg);
      p.overlap = permittedOverlap(c);
    }

    // 2. Collision relaxation — direct push-apart, multiple passes.
    const searchR = 3 * cfg.maxRadius;
    for (let pass = 0; pass < cfg.relaxationPasses; pass++) {
      const tree = quadtree<SimPin>().x((p) => p.dx).y((p) => p.dy).addAll(pins);
      for (const p of pins) {
        visitWithin(tree, p.dx, p.dy, searchR, (q) => {
          if (q.id <= p.id) return;
          let ddx = q.dx - p.dx;
          let ddy = q.dy - p.dy;
          let dist = Math.hypot(ddx, ddy);
          if (dist === 0) { ddx = 0.01; dist = 0.01; }
          const desired = Math.max(
            (p.radius + q.radius) * (1 - 0.5 * (p.overlap + q.overlap)),
            2 * cfg.maxRadius,
          );
          if (dist < desired) {
            const push = (desired - dist) / 2;
            const ux = ddx / dist;
            const uy = ddy / dist;
            p.dx -= ux * push;
            p.dy -= uy * push;
            q.dx += ux * push;
            q.dy += uy * push;
          }
        });
      }
    }

    // 3. Anchor spring + symplectic-Euler integration with damping.
    let maxMove = 0;
    const k = cfg.anchorStiffness;
    const damp = cfg.damping;
    for (const p of pins) {
      p.vx = (p.vx + (p.x - p.dx) * k) * damp;
      p.vy = (p.vy + (p.y - p.dy) * k) * damp;
      p.dx += p.vx;
      p.dy += p.vy;
      const m = Math.abs(p.vx) + Math.abs(p.vy);
      if (m > maxMove) maxMove = m;
    }
    return maxMove > cfg.stabilityThreshold;
  }

  pick(px: number, py: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const p of this.list) {
      const d = Math.hypot(p.dx - px, p.dy - py);
      if (d <= p.radius && d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    return best;
  }
}
