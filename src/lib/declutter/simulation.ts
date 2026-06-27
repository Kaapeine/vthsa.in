import { quadtree } from 'd3-quadtree';
import type { Anchor, SimConfig, SimPin } from './types';
import { crowdingFactor, radiusForCrowding, permittedOverlap } from './crowding';
import { visitWithin } from './quadtree';

export class Simulation {
  private cfg: SimConfig;
  private pins = new Map<number, SimPin>();
  private list: SimPin[] = [];

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
  }

  setAnchors(anchors: Anchor[]): void {
    const seen = new Set<number>();
    for (const a of anchors) {
      seen.add(a.id);
      const existing = this.pins.get(a.id);
      if (existing) {
        existing.x = a.x;
        existing.y = a.y;
      } else {
        const jitter = a.id % 2 === 0 ? 0.5 : -0.5;
        this.pins.set(a.id, {
          id: a.id,
          x: a.x,
          y: a.y,
          dx: a.x + jitter,
          dy: a.y,
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

  tick(): boolean {
    const pins = this.list;
    if (pins.length === 0) return false;
    const cfg = this.cfg;

    // 1. Density → radius + permitted overlap.
    let tree = quadtree<SimPin>().x((p) => p.dx).y((p) => p.dy).addAll(pins);
    for (const p of pins) {
      let count = 0;
      visitWithin(tree, p.dx, p.dy, cfg.neighborRadius, (q) => {
        if (q !== p) count++;
      });
      const c = crowdingFactor(count, cfg);
      p.radius = radiusForCrowding(c, cfg);
      p.overlap = permittedOverlap(c);
    }

    // 2. Collision relaxation — direct push-apart, multiple passes.
    const searchR = 2 * cfg.maxRadius;
    for (let pass = 0; pass < cfg.relaxationPasses; pass++) {
      tree = quadtree<SimPin>().x((p) => p.dx).y((p) => p.dy).addAll(pins);
      for (const p of pins) {
        visitWithin(tree, p.dx, p.dy, searchR, (q) => {
          if (q.id <= p.id) return;
          let ddx = q.dx - p.dx;
          let ddy = q.dy - p.dy;
          let dist = Math.hypot(ddx, ddy);
          if (dist === 0) { ddx = 0.01; dist = 0.01; }
          const desired = (p.radius + q.radius) * (1 - 0.5 * (p.overlap + q.overlap));
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
