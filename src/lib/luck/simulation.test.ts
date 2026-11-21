import { describe, it, expect } from 'vitest';
import { DEFAULT_PARAMS, simulate, simulateLife, summarize, kellyCurve, networkEcho, poisson, mulberry32 } from './simulation';

const P = { ...DEFAULT_PARAMS, years: 5 };

describe('simulate', () => {
  it('is deterministic for a given seed', () => {
    const a = simulate(P, 50, 42).finals;
    const b = simulate(P, 50, 42).finals;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('does nothing when you take no chances and have no network', () => {
    const { finals } = simulate({ ...P, bold: 0 }, 20, 1);
    expect(Array.from(finals).every((v) => v === 0)).toBe(true);
  });

  it('never goes negative in additive mode without losses', () => {
    const { finals } = simulate({ ...P, q: 0 }, 200, 3);
    expect(Math.min(...finals)).toBeGreaterThanOrEqual(0);
  });

  it('takes more chances means a higher median, below the burnout pace', () => {
    const lo = summarize(simulate({ ...P, bold: 0.5 }, 300, 5).finals).p50;
    const hi = summarize(simulate({ ...P, bold: 2 }, 300, 5).finals).p50;
    expect(hi).toBeGreaterThan(lo);
  });

  it('burns out far past the sustainable pace', () => {
    const r = simulate({ ...P, bold: 12 }, 100, 9);
    expect(r.burnFrac).toBeGreaterThan(0.5);
  });

  it('ruins more lives at large stakes in multiplicative mode', () => {
    const small = simulate({ ...P, years: 20, mult: true, stake: 0.03 }, 300, 2).ruined;
    const big = simulate({ ...P, years: 20, mult: true, stake: 0.25 }, 300, 2).ruined;
    expect(big).toBeGreaterThan(small);
  });

  it('records one path sample every 4 weeks', () => {
    const { paths } = simulate(P, 3, 1, 3);
    expect(paths).toHaveLength(3);
    expect(paths[0]).toHaveLength(Math.floor((5 * 52) / 4) + 1);
  });
});

describe('poisson', () => {
  it('has roughly the requested mean', () => {
    const r = mulberry32(11);
    for (const lam of [0.5, 3, 50]) {
      let s = 0;
      for (let i = 0; i < 20000; i++) s += poisson(lam, r);
      expect(s / 20000).toBeCloseTo(lam, lam > 10 ? 0 : 1);
    }
  });
});

describe('kellyCurve', () => {
  it('has zero growth at zero stake and an interior optimum at the defaults', () => {
    const k = kellyCurve({ ...DEFAULT_PARAMS, mult: true });
    expect(k.pts[0].g).toBe(0);
    expect(k.fStar).toBeGreaterThan(0.05);
    expect(k.fStar).toBeLessThan(0.14);
    expect(k.fZero).not.toBeNull();
  });
});

describe('networkEcho', () => {
  it('matches the formula at the defaults', () => {
    const expected = (0.1 + 1.5 * 0.03) * 0.02 * ((3 * 52) / Math.LN2);
    expect(networkEcho(DEFAULT_PARAMS)).toBeCloseTo(expected, 10);
  });
});

describe('simulateLife', () => {
  it('replays life i of a run exactly', () => {
    const run = simulate(P, 5, 77);
    for (let i = 0; i < 5; i++) {
      const life = simulateLife(P, 77, i);
      expect(life.capital[life.capital.length - 1]).toBe(run.finals[i]);
    }
  });

  it('records one entry per week plus the start, and a summary every year', () => {
    const life = simulateLife(P, 3);
    expect(life.capital).toHaveLength(5 * 52 + 1);
    expect(life.events.filter((e) => e.kind === 'year')).toHaveLength(5);
  });

  it('logs events in week order', () => {
    const { events } = simulateLife({ ...P, years: 20, bold: 8 }, 4);
    for (let i = 1; i < events.length; i++) expect(events[i].week).toBeGreaterThanOrEqual(events[i - 1].week);
    expect(events.some((e) => e.kind === 'burnout')).toBe(true);
  });
});
