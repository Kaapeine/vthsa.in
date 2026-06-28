import { describe, it, expect } from 'vitest';
import { Simulation } from './simulation';
import { DEFAULT_CONFIG, type Anchor } from './types';

function settle(sim: Simulation, maxTicks = 2000): number {
  let n = 0;
  while (sim.tick() && n < maxTicks) n++;
  return n;
}

describe('Simulation', () => {
  it('separates two pins sharing an identical anchor', () => {
    const sim = new Simulation(DEFAULT_CONFIG);
    const anchors: Anchor[] = [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 100, y: 100 },
    ];
    sim.setAnchors(anchors);
    settle(sim);
    const [a, b] = sim.getPins();
    const dist = Math.hypot(a.dx - b.dx, a.dy - b.dy);
    expect(dist).toBeGreaterThan(DEFAULT_CONFIG.maxRadius);
    expect(dist).toBeLessThanOrEqual(2 * DEFAULT_CONFIG.maxRadius + 0.5);
  });

  it('pulls a displaced lone pin back to its anchor', () => {
    const sim = new Simulation({ ...DEFAULT_CONFIG, stabilityThreshold: 0.001 });
    sim.setAnchors([{ id: 1, x: 100, y: 100 }]);
    const p = sim.getPins()[0];
    p.dx = 300;
    p.dy = 100;
    p.vx = 0;
    p.vy = 0;
    settle(sim);
    const q = sim.getPins()[0];
    expect(q.dx).toBeCloseTo(100, 0);
    expect(q.dy).toBeCloseTo(100, 0);
  });

  it('goes idle (tick returns false) once settled', () => {
    const sim = new Simulation(DEFAULT_CONFIG);
    sim.setAnchors([{ id: 1, x: 50, y: 50 }]);
    settle(sim);
    expect(sim.tick()).toBe(false);
  });

  it('adds and removes pins on setAnchors', () => {
    const sim = new Simulation(DEFAULT_CONFIG);
    sim.setAnchors([{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }]);
    expect(sim.getPins().map((p) => p.id).sort()).toEqual([1, 2]);
    sim.setAnchors([{ id: 2, x: 10, y: 0 }, { id: 3, x: 20, y: 0 }]);
    expect(sim.getPins().map((p) => p.id).sort()).toEqual([2, 3]);
  });

  it('picks the nearest pin within its radius, else null', () => {
    const sim = new Simulation({ ...DEFAULT_CONFIG, stabilityThreshold: 0.001 });
    sim.setAnchors([{ id: 7, x: 200, y: 200 }]);
    settle(sim);
    expect(sim.pick(202, 201)).toBe(7);
    expect(sim.pick(400, 400)).toBeNull();
  });
});
