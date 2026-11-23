// "Many people": a population whose settings differ, to separate the effect of
// settings from the effect of luck. Each person gets their own values for one or
// two settings (the rest are shared), then lives `rolls` independent lives.

import { mulberry32, simulate, summarize, type Params, type Rng } from './simulation';

export type VaryKey = 'bold' | 'p0' | 'tieRate' | 'q' | 'alpha' | 'lossSize' | 'refRate' | 'tieHalfLife' | 'learn' | 'stake';

export interface VarySpec {
  key: VaryKey;
  /**
   * realistic: log-normal with its median at the shared setting, truncated to [min, max].
   * range: uniform on [min, max].
   */
  dist: 'realistic' | 'range';
  min: number;
  max: number;
}

/** Log-normal σ for the realistic spread of each setting. */
export const SIGMA: Record<VaryKey, number> = {
  bold: 0.7, p0: 0.5, tieRate: 0.5, q: 0.5, alpha: 0.15, lossSize: 0.5,
  refRate: 0.5, tieHalfLife: 0.5, learn: 0.5, stake: 0.5,
};

/** The y-axis scale the page plots on: log10 of capital, or symmetric log of an additive score. */
export function toLogScale(v: number, mult: boolean): number {
  return mult ? Math.log10(Math.max(v, 1e-3)) : Math.sign(v) * Math.log10(1 + Math.abs(v));
}

function gauss(r: Rng): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

function drawOne(spec: VarySpec, median: number, r: Rng): number {
  if (spec.dist === 'range') return spec.min + (spec.max - spec.min) * r();
  if (median <= 0) return 0;
  const s = SIGMA[spec.key];
  for (let tries = 0; tries < 50; tries++) {
    const v = median * Math.exp(s * gauss(r));
    if (v >= spec.min && v <= spec.max) return v;
  }
  return Math.min(spec.max, Math.max(spec.min, median));
}

/** values[i][j] is person i's value for specs[j]. Deterministic for a seed. */
export function drawPeople(base: Params, specs: VarySpec[], n: number, seed: number): number[][] {
  const r = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const out: number[][] = [];
  for (let i = 0; i < n; i++) out.push(specs.map((s) => drawOne(s, base[s.key], r)));
  return out;
}

export function personParams(base: Params, specs: VarySpec[], vals: number[]): Params {
  const P = { ...base };
  specs.forEach((s, j) => { P[s.key] = vals[j]; });
  return P;
}

/** Seed for person i's lives; roll k of that person is lifeRng(personSeed, k). */
export function personSeed(seed: number, i: number): number {
  return (Math.imul(seed, 2654435761) ^ Math.imul(i + 1, 40503)) >>> 0;
}

export interface PersonResult {
  /** Outcome of roll #1 (the same life the one-roll view shows). */
  first: number;
  median: number;
  /** Mean and unbiased variance of the log-scale outcome across rolls. */
  zMean: number;
  zVar: number;
}

export function runPerson(P: Params, rolls: number, seed: number): PersonResult {
  const { finals } = simulate(P, rolls, seed);
  let m = 0;
  const z = Array.from(finals, (v) => toLogScale(v, P.mult));
  for (const v of z) m += v;
  m /= z.length;
  let ss = 0;
  for (const v of z) ss += (v - m) ** 2;
  return { first: finals[0], median: summarize(finals).p50, zMean: m, zVar: z.length > 1 ? ss / (z.length - 1) : 0 };
}

/**
 * Share of the variance in log outcome that comes from differences in settings
 * (one-way variance decomposition). Between-person variance of the per-person
 * means is corrected for the noise in estimating each mean from `rolls` lives.
 */
export function explainedShare(results: Pick<PersonResult, 'zMean' | 'zVar'>[], rolls: number): number {
  const n = results.length;
  if (n < 2) return 0;
  let mm = 0, within = 0;
  for (const r of results) { mm += r.zMean; within += r.zVar; }
  mm /= n;
  within /= n;
  let between = 0;
  for (const r of results) between += (r.zMean - mm) ** 2;
  between = Math.max(0, between / (n - 1) - within / rolls);
  return between + within > 0 ? between / (between + within) : 0;
}
