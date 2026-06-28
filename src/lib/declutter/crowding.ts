import type { SimConfig } from './types';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function crowdingFactor(neighborCount: number, cfg: SimConfig): number {
  const capacity = (cfg.neighborRadius / cfg.maxRadius) ** 2;
  return neighborCount / capacity;
}

export function radiusForCrowding(crowding: number, cfg: SimConfig): number {
  const t = clamp01(crowding);
  return cfg.maxRadius - (cfg.maxRadius - cfg.minRadius) * t;
}

export function permittedOverlap(crowding: number): number {
  return clamp01(crowding - 1);
}
