import { describe, it, expect } from 'vitest';
import { DEFAULT_PARAMS, simulate } from './simulation';
import { drawPeople, explainedShare, personParams, personSeed, runPerson, type VarySpec } from './people';

const P = { ...DEFAULT_PARAMS, years: 5 };

describe('drawPeople', () => {
  it('keeps realistic draws inside the bounds, centred on the shared setting', () => {
    const spec: VarySpec = { key: 'bold', dist: 'realistic', min: 0, max: 15 };
    const vals = drawPeople(P, [spec], 2000, 1).map((v) => v[0]).sort((a, b) => a - b);
    expect(vals[0]).toBeGreaterThanOrEqual(0);
    expect(vals[vals.length - 1]).toBeLessThanOrEqual(15);
    expect(vals[1000]).toBeGreaterThan(1.7);
    expect(vals[1000]).toBeLessThan(2.3);
  });

  it('spreads range draws evenly between min and max', () => {
    const spec: VarySpec = { key: 'p0', dist: 'range', min: 0.01, max: 0.1 };
    const vals = drawPeople(P, [spec], 2000, 2).map((v) => v[0]);
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0.01);
    expect(Math.max(...vals)).toBeLessThanOrEqual(0.1);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    expect(mean).toBeCloseTo(0.055, 2);
  });

  it('gives everyone zero when the shared setting is zero', () => {
    const vals = drawPeople({ ...P, tieRate: 0 }, [{ key: 'tieRate', dist: 'realistic', min: 0, max: 0.4 }], 10, 3);
    expect(vals.every((v) => v[0] === 0)).toBe(true);
  });
});

describe('runPerson', () => {
  it("reports roll #1 as the same life a single roll gives", () => {
    const specs: VarySpec[] = [{ key: 'bold', dist: 'range', min: 1, max: 4 }];
    const Pi = personParams(P, specs, [3]);
    const s = personSeed(9, 4);
    expect(runPerson(Pi, 20, s).first).toBe(simulate(Pi, 1, s).finals[0]);
  });
});

describe('explainedShare', () => {
  it('is 0 when everyone has the same expected outcome', () => {
    const r = Array.from({ length: 50 }, () => ({ zMean: 1, zVar: 0.5 }));
    expect(explainedShare(r, 100)).toBe(0);
  });

  it('is 1 when there is no luck', () => {
    const r = Array.from({ length: 50 }, (_, i) => ({ zMean: i, zVar: 0 }));
    expect(explainedShare(r, 100)).toBe(1);
  });

  it('is near 0 when settings do not matter at all', () => {
    const specs: VarySpec[] = [{ key: 'lossSize', dist: 'range', min: 0, max: 5 }];
    const base = { ...P, q: 0 }; // no losses, so loss size is irrelevant
    const results = drawPeople(base, specs, 60, 5).map((v, i) => runPerson(personParams(base, specs, v), 40, personSeed(5, i)));
    expect(explainedShare(results, 40)).toBeLessThan(0.08);
  });

  it('is clearly above zero when boldness varies widely', () => {
    const specs: VarySpec[] = [{ key: 'bold', dist: 'range', min: 0.2, max: 4 }];
    const results = drawPeople(P, specs, 60, 6).map((v, i) => runPerson(personParams(P, specs, v), 40, personSeed(6, i)));
    expect(explainedShare(results, 40)).toBeGreaterThan(0.2);
  });
});
