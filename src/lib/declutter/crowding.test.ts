import { describe, it, expect } from 'vitest';
import { crowdingFactor, radiusForCrowding, permittedOverlap } from './crowding';
import { DEFAULT_CONFIG } from './types';

const cfg = DEFAULT_CONFIG;

describe('crowdingFactor', () => {
  it('is 0 when there are no neighbors', () => {
    expect(crowdingFactor(0, cfg)).toBe(0);
  });
  it('reaches ~1 at capacity = (neighborRadius/minRadius)^2', () => {
    const capacity = (cfg.neighborRadius / cfg.minRadius) ** 2;
    expect(crowdingFactor(capacity, cfg)).toBeCloseTo(1, 5);
  });
  it('increases monotonically with neighbor count', () => {
    expect(crowdingFactor(20, cfg)).toBeLessThan(crowdingFactor(40, cfg));
  });
});

describe('radiusForCrowding', () => {
  it('is maxRadius when uncrowded', () => {
    expect(radiusForCrowding(0, cfg)).toBe(cfg.maxRadius);
  });
  it('is minRadius at/above capacity', () => {
    expect(radiusForCrowding(1, cfg)).toBe(cfg.minRadius);
    expect(radiusForCrowding(5, cfg)).toBe(cfg.minRadius);
  });
  it('interpolates between the two at half crowding', () => {
    const mid = (cfg.maxRadius + cfg.minRadius) / 2;
    expect(radiusForCrowding(0.5, cfg)).toBeCloseTo(mid, 5);
  });
});

describe('permittedOverlap', () => {
  it('is 0 at or below capacity', () => {
    expect(permittedOverlap(0)).toBe(0);
    expect(permittedOverlap(1)).toBe(0);
  });
  it('rises toward 1 as crowding passes capacity', () => {
    expect(permittedOverlap(1.5)).toBeCloseTo(0.5, 5);
    expect(permittedOverlap(2)).toBe(1);
    expect(permittedOverlap(10)).toBe(1);
  });
});
