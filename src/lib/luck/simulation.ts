// Monte Carlo model behind /toys/luck-surface-area.
//
// One simulated life is a week-by-week loop. Each week you take a Poisson
// number of chances (your boldness) plus chances referred by your connections.
// Each chance can hit (Pareto payoff), be a loss, or be a dud. Hits feed back
// into skill (higher hit rate) and connections (more referrals); losses can
// burn bridges; every attempt drains energy, and running out means burnout.

export interface Params {
  /** Mean chances you take per week. */
  bold: number;
  years: number;
  /** Starting probability that one attempt hits. */
  p0: number;
  /** Pareto tail index of hit payoffs (minimum payoff 1). Lower = fatter tail. */
  alpha: number;
  /** Probability that an attempt leaves a lasting connection. */
  tieRate: number;
  /** Chances each connection refers to you per week. */
  refRate: number;
  /** Half-life of a connection, in years. */
  tieHalfLife: number;
  /** Each hit adds this to skill; hit rate = p0 × (1 + skill). */
  learn: number;
  /** Probability that an attempt is a loss. */
  q: number;
  /** Mean of the exponential loss size (additive mode). */
  lossSize: number;
  burnout: boolean;
  bridges: boolean;
  /** Multiplicative dynamics: hits and losses scale with current capital. */
  mult: boolean;
  /** Fraction of capital at stake per attempt (multiplicative mode). */
  stake: number;
  /** 1-in-1000 chance per attempt of losing 90% (multiplicative mode). */
  catastrophe: boolean;
}

export const DEFAULT_PARAMS: Params = {
  bold: 2, years: 20, p0: 0.03, alpha: 1.5,
  tieRate: 0.1, refRate: 0.02, tieHalfLife: 3, learn: 0.05,
  q: 0.05, lossSize: 1, burnout: true, bridges: true,
  mult: false, stake: 0.05, catastrophe: false,
};

// Fixed model constants (shown in the page copy; keep in sync).
export const P_CAP = 0.3;
export const REFERRAL_BOOST = 1.5;
export const ENERGY_DUD = 0.05;
export const ENERGY_LOSS = 0.15;
export const ENERGY_HIT_BONUS = 0.05;
export const ENERGY_RECOVER = 0.25;
export const DECLINE_BELOW = 0.3;
export const BURNOUT_WEEKS = 8;
export const CATASTROPHE_P = 0.001;
export const CATASTROPHE_KEEP = 0.1;
export const RUIN_BELOW = 0.01;
/** Paths are sampled every PATH_STEP weeks. */
export const PATH_STEP = 4;

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r: Rng): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Knuth's method; normal approximation for large means. */
export function poisson(lam: number, r: Rng): number {
  if (lam <= 0) return 0;
  if (lam > 30) {
    const n = Math.round(lam + Math.sqrt(lam) * gauss(r));
    return n < 0 ? 0 : n;
  }
  const L = Math.exp(-lam);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}

export interface SimResult {
  finals: Float64Array;
  /** Capital every PATH_STEP weeks, for the first nPaths lives. */
  paths: Float64Array[];
  /** Fraction of all simulated weeks spent burnt out. */
  burnFrac: number;
  /** Fraction of lives ruined (multiplicative mode only). */
  ruined: number;
}

export function simulate(P: Params, runs: number, seed: number, nPaths = 0): SimResult {
  const r = mulberry32(seed);
  const weeks = Math.round(P.years * 52);
  const decay = Math.pow(0.5, 1 / (P.tieHalfLife * 52));
  const finals = new Float64Array(runs);
  const paths: Float64Array[] = [];
  let burnTot = 0;
  let ruinedN = 0;

  for (let i = 0; i < runs; i++) {
    let C = P.mult ? 1 : 0; // capital / score
    let T = 0; // connections
    let s = 0; // skill
    let E = 1; // energy
    let burn = 0; // burnout weeks remaining
    let ruined = false;
    const path = i < nPaths ? new Float64Array(Math.floor(weeks / PATH_STEP) + 1) : null;
    if (path) path[0] = C;

    for (let w = 1; w <= weeks; w++) {
      if (burn > 0) {
        burn--;
        burnTot++;
        T *= decay;
        if (path && w % PATH_STEP === 0) path[w / PATH_STEP] = C;
        continue;
      }
      if (!ruined) {
        const nRef = poisson(T * P.refRate, r);
        const n = nRef + poisson(P.bold, r);
        for (let k = 0; k < n; k++) {
          const ref = k < nRef; // referrals are handled first
          if (P.burnout) {
            if (ref && E < DECLINE_BELOW) continue;
            if (E <= 0) break;
          }
          if (r() < P.tieRate) T += 1;
          const p = Math.min(P_CAP, P.p0 * (1 + s) * (ref ? REFERRAL_BOOST : 1));
          const u = r();
          const costMul = ref ? 0.5 : 1;
          if (u < p) {
            s += P.learn;
            T += 1;
            E = Math.min(1, E + ENERGY_HIT_BONUS);
            const X = Math.pow(1 - r(), -1 / P.alpha); // Pareto(alpha, 1)
            if (P.mult) C *= 1 + P.stake * X;
            else C += X;
          } else if (u < p + P.q) {
            E -= ENERGY_LOSS * costMul;
            if (P.bridges) {
              T = Math.max(0, T - 1);
              s *= 0.9;
            }
            if (P.mult) C *= 1 - P.stake;
            else C += P.lossSize * Math.log(1 - r()); // minus an Exponential(mean lossSize)
          } else {
            E -= ENERGY_DUD * costMul;
          }
          if (P.mult && P.catastrophe && r() < CATASTROPHE_P) C *= CATASTROPHE_KEEP;
          if (P.mult && C < RUIN_BELOW) {
            ruined = true;
            C = RUIN_BELOW;
            break;
          }
        }
        if (P.burnout && E <= 0) {
          burn = BURNOUT_WEEKS;
          E = 1;
        }
        E = Math.min(1, E + ENERGY_RECOVER);
      }
      T *= decay;
      if (path && w % PATH_STEP === 0) path[w / PATH_STEP] = C;
    }
    finals[i] = C;
    if (ruined) ruinedN++;
    if (path) paths.push(path);
  }
  return { finals, paths, burnFrac: burnTot / (runs * weeks), ruined: ruinedN / runs };
}

export interface Summary {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
}

function quantile(sorted: Float64Array, q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export function summarize(values: ArrayLike<number>): Summary {
  const s = Float64Array.from(values).sort();
  let m = 0;
  for (const v of s) m += v;
  return { p10: quantile(s, 0.1), p50: quantile(s, 0.5), p90: quantile(s, 0.9), mean: m / s.length };
}

/**
 * Expected number of later chances one chance generates through the network:
 * (connections per chance) × (referrals per connection per week) × (mean
 * connection lifetime in weeks). The branching-process threshold is R = 1.
 */
export function networkEcho(P: Params): number {
  const lifeWeeks = (P.tieHalfLife * 52) / Math.LN2;
  return (P.tieRate + REFERRAL_BOOST * P.p0) * P.refRate * lifeWeeks;
}

export interface KellyPoint {
  f: number;
  /** Expected log growth per chance (what one life compounds at). */
  g: number;
  /** Expected arithmetic return per chance (the cross-person average). */
  ev: number;
}

export interface KellyCurve {
  pts: KellyPoint[];
  /** Kelly stake: argmax of g. */
  fStar: number;
  gStar: number;
  /** Smallest stake above fStar where growth drops back below zero, if found. */
  fZero: number | null;
  fMax: number;
}

/** Growth vs stake for one attempt at the starting hit rate. */
export function kellyCurve(P: Params, samples = 10000): KellyCurve {
  const r = mulberry32(7);
  const X = new Float64Array(samples);
  for (let i = 0; i < samples; i++) X[i] = Math.pow(1 - r(), -1 / P.alpha);
  const EX = P.alpha / (P.alpha - 1);
  const cat = P.catastrophe ? CATASTROPHE_P : 0;
  const g = (f: number) => {
    let s = 0;
    for (let i = 0; i < samples; i++) s += Math.log1p(f * X[i]);
    return P.p0 * (s / samples) + P.q * Math.log(1 - f) + cat * Math.log(CATASTROPHE_KEEP);
  };
  const ev = (f: number) => P.p0 * f * EX - P.q * f - cat * (1 - CATASTROPHE_KEEP);

  let fStar = 0;
  let gStar = g(0);
  for (let f = 0.0025; f < 0.95; f += 0.0025) {
    const v = g(f);
    if (v > gStar) {
      gStar = v;
      fStar = f;
    }
  }
  let fZero: number | null = null;
  for (let f = fStar + 0.0025; gStar > 0 && f < 0.99; f += 0.0025) {
    if (g(f) < 0) {
      fZero = f;
      break;
    }
  }
  const fMax = Math.min(0.6, Math.max(0.05, P.stake * 1.4, (fZero ?? fStar * 2.5) * 1.15));
  const pts: KellyPoint[] = [];
  for (let i = 0; i <= 120; i++) {
    const f = (fMax * i) / 120;
    pts.push({ f, g: g(f), ev: ev(f) });
  }
  return { pts, fStar, gStar, fZero, fMax };
}
