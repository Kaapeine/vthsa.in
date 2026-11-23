// Monte Carlo model behind /toys/luck-surface-area.
//
// One simulated life is a week-by-week loop. Each week you take a Poisson
// number of chances (your boldness) plus chances referred by your connections.
// Each chance can hit (Pareto payoff), be a loss, or be a dud. Practice raises
// your hit rate with diminishing returns; the first few chances each week are
// your best ones; hits and chances build connections, which refer more chances.
// Losses cost score and energy; running out of energy means burnout.

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
  /** Best hit rate practice can get you to. */
  pMax: number;
  /** Attempts (practice) needed to close half the gap from p0 to pMax. */
  halfway: number;
  /** Good chances available per week: the k-th of your own chances in a week hits at 1 / (1 + (k−1)/goodPerWeek) of your rate. */
  goodPerWeek: number;
  /** Probability that an attempt is a loss. */
  q: number;
  /** Mean of the exponential loss size (additive mode). */
  lossSize: number;
  burnout: boolean;
  /** Multiplicative dynamics: hits and losses scale with current capital. */
  mult: boolean;
  /** Fraction of capital at stake per attempt (multiplicative mode). */
  stake: number;
  /** 1-in-1000 chance per attempt of losing 90% (multiplicative mode). */
  catastrophe: boolean;
}

export const DEFAULT_PARAMS: Params = {
  bold: 2, years: 20, p0: 0.03, alpha: 1.5,
  tieRate: 0.1, refRate: 0.02, tieHalfLife: 3,
  pMax: 0.12, halfway: 300, goodPerWeek: 3,
  q: 0.05, lossSize: 1, burnout: true,
  mult: false, stake: 0.05, catastrophe: false,
};

// Fixed model constants (shown in the page copy; keep in sync).
/** Referral hit rate = your rate × REFERRAL_BOOST, capped here. */
export const REF_CAP = 0.9;
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

/** Independent, reproducible stream for life `i` of a run with `seed`. */
export function lifeRng(seed: number, i: number): Rng {
  return mulberry32((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
}

export type LifeEventKind = 'first-hit' | 'hit' | 'loss' | 'burnout' | 'ties' | 'skill' | 'catastrophe' | 'ruin' | 'year';

export interface LifeEvent {
  week: number;
  kind: LifeEventKind;
  /** Payoff X for hits, loss size for losses, threshold for milestones. */
  value: number;
  /** Hit or loss came through a connection's referral. */
  referral?: boolean;
  /** Year summaries: hits and losses that year, referrals turned down. */
  hits?: number;
  losses?: number;
  declined?: number;
}

/** Week-by-week record of one life (index 0 = start, then one entry per week). */
export interface LifeRecord {
  capital: Float64Array;
  ties: Float64Array;
  /** Own (non-referral) hit rate at the end of the week. */
  hitRate: Float64Array;
  /** Energy after the week's chances, before recovery. */
  energy: Float64Array;
  burnt: Uint8Array;
  /** Largest hit payoff that week (0 if none). */
  bestHit: Float64Array;
  /** Hits that week. */
  hits: Uint8Array;
  /** Losses that week. */
  losses: Uint8Array;
  events: LifeEvent[];
}

/** Hits at or above this payoff go into the event log. */
export const NOTABLE_HIT = 4;
/** Additive losses at or above this size go into the event log. */
export const NOTABLE_LOSS = 2.5;
const TIE_MILESTONES = [5, 10, 25, 50, 100, 250, 500];
const SKILL_MILESTONES = [0.5, 0.75, 0.9]; // share of the gap from p0 to pMax closed by practice

function newRecord(weeks: number): LifeRecord {
  const n = weeks + 1;
  return {
    capital: new Float64Array(n), ties: new Float64Array(n), hitRate: new Float64Array(n),
    energy: new Float64Array(n), burnt: new Uint8Array(n), bestHit: new Float64Array(n),
    hits: new Uint8Array(n), losses: new Uint8Array(n), events: [],
  };
}

interface LifeOutcome {
  C: number;
  ruined: boolean;
  burnWeeks: number;
}

/**
 * Runs one life. `path` (optional) receives capital every PATH_STEP weeks;
 * `rec` (optional) receives the full week-by-week record and event log.
 */
function runLife(P: Params, r: Rng, path: Float64Array | null, rec: LifeRecord | null): LifeOutcome {
  const weeks = Math.round(P.years * 52);
  const decay = Math.pow(0.5, 1 / (P.tieHalfLife * 52));
  let C = P.mult ? 1 : 0; // capital / score
  let T = 0; // connections
  let n = 0; // practice: attempts taken so far
  let E = 1; // energy
  let burn = 0; // burnout weeks remaining
  let ruined = false;
  let burnWeeks = 0;
  // recorder-only state
  let anyHit = false, tieM = 0, skillM = 0, yHits = 0, yLoss = 0, yDecl = 0;
  if (path) path[0] = C;
  if (rec) {
    rec.capital[0] = C; rec.hitRate[0] = P.p0; rec.energy[0] = 1;
  }

  for (let w = 1; w <= weeks; w++) {
    let best = 0, nHit = 0, nLoss = 0, wasBurnt = false, eAfter = E;
    if (burn > 0) {
      burn--;
      burnWeeks++;
      wasBurnt = true;
    } else if (!ruined) {
      const nRef = poisson(T * P.refRate, r);
      const nAll = nRef + poisson(P.bold, r);
      for (let k = 0; k < nAll; k++) {
        const ref = k < nRef; // referrals are handled first
        if (P.burnout) {
          if (ref && E < DECLINE_BELOW) { if (rec) yDecl++; continue; }
          if (E <= 0) break;
        }
        if (r() < P.tieRate) T += 1;
        const rate = practiceRate(P, n);
        const p = ref ? Math.min(REF_CAP, rate * REFERRAL_BOOST) : rate * chanceQuality(P, k - nRef);
        n++;
        const u = r();
        const costMul = ref ? 0.5 : 1;
        if (u < p) {
          T += 1;
          E = Math.min(1, E + ENERGY_HIT_BONUS);
          const X = Math.pow(1 - r(), -1 / P.alpha); // Pareto(alpha, 1)
          if (P.mult) C *= 1 + P.stake * X;
          else C += X;
          if (rec) {
            yHits++; nHit++;
            if (X > best) best = X;
            if (!anyHit) { anyHit = true; rec.events.push({ week: w, kind: 'first-hit', value: X, referral: ref }); }
            else if (X >= NOTABLE_HIT) rec.events.push({ week: w, kind: 'hit', value: X, referral: ref });
          }
        } else if (u < p + P.q) {
          E -= ENERGY_LOSS * costMul;
          let size: number;
          if (P.mult) { size = P.stake; C *= 1 - P.stake; }
          else { size = -P.lossSize * Math.log(1 - r()); C -= size; } // Exponential(mean lossSize)
          if (rec) {
            yLoss++; nLoss++;
            if (!P.mult && size >= NOTABLE_LOSS) rec.events.push({ week: w, kind: 'loss', value: size, referral: ref });
          }
        } else {
          E -= ENERGY_DUD * costMul;
        }
        if (P.mult && P.catastrophe && r() < CATASTROPHE_P) {
          C *= CATASTROPHE_KEEP;
          if (rec) rec.events.push({ week: w, kind: 'catastrophe', value: 1 - CATASTROPHE_KEEP });
        }
        if (P.mult && C < RUIN_BELOW) {
          ruined = true;
          C = RUIN_BELOW;
          if (rec) rec.events.push({ week: w, kind: 'ruin', value: C });
          break;
        }
      }
      eAfter = Math.max(0, E);
      if (P.burnout && E <= 0) {
        burn = BURNOUT_WEEKS;
        E = 1;
        if (rec) rec.events.push({ week: w, kind: 'burnout', value: BURNOUT_WEEKS });
      }
      E = Math.min(1, E + ENERGY_RECOVER);
    }
    T *= decay;
    if (path && w % PATH_STEP === 0) path[w / PATH_STEP] = C;
    if (rec) {
      rec.capital[w] = C; rec.ties[w] = T; rec.hitRate[w] = practiceRate(P, n);
      rec.energy[w] = wasBurnt ? 0 : eAfter; rec.burnt[w] = wasBurnt ? 1 : 0;
      rec.bestHit[w] = best; rec.hits[w] = Math.min(255, nHit); rec.losses[w] = Math.min(255, nLoss);
      while (tieM < TIE_MILESTONES.length && T >= TIE_MILESTONES[tieM]) {
        rec.events.push({ week: w, kind: 'ties', value: TIE_MILESTONES[tieM] }); tieM++;
      }
      while (skillM < SKILL_MILESTONES.length && P.pMax > P.p0 && n / (n + P.halfway) >= SKILL_MILESTONES[skillM]) {
        rec.events.push({ week: w, kind: 'skill', value: SKILL_MILESTONES[skillM] }); skillM++;
      }
      if (w % 52 === 0) {
        rec.events.push({ week: w, kind: 'year', value: C, hits: yHits, losses: yLoss, declined: yDecl });
        yHits = 0; yLoss = 0; yDecl = 0;
      }
    }
  }
  return { C, ruined, burnWeeks };
}

/**
 * Your hit rate after n attempts. Practice closes the gap to the best possible
 * rate with diminishing returns (a power law of practice with exponent 1):
 * after `halfway` attempts half the gap is closed, after 3 × halfway three quarters.
 */
export function practiceRate(P: Params, n: number): number {
  const best = Math.max(P.pMax, P.p0);
  return best - (best - P.p0) / (1 + n / P.halfway);
}

/** Hit-rate multiplier for your k-th own chance in a week (k from 0): later ones are worse. */
export function chanceQuality(P: Params, k: number): number {
  return 1 / (1 + k / P.goodPerWeek);
}

/** One fully recorded life: life `index` of the run with `seed`. */
export function simulateLife(P: Params, seed: number, index = 0): LifeRecord {
  const rec = newRecord(Math.round(P.years * 52));
  runLife(P, lifeRng(seed, index), null, rec);
  return rec;
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
  const weeks = Math.round(P.years * 52);
  const finals = new Float64Array(runs);
  const paths: Float64Array[] = [];
  let burnTot = 0;
  let ruinedN = 0;
  for (let i = 0; i < runs; i++) {
    const path = i < nPaths ? new Float64Array(Math.floor(weeks / PATH_STEP) + 1) : null;
    const o = runLife(P, lifeRng(seed, i), path, null);
    finals[i] = o.C;
    burnTot += o.burnWeeks;
    if (o.ruined) ruinedN++;
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

/**
 * Own chances per week you can keep up without burning out: weekly energy
 * recovery divided by the expected energy cost of one chance at the starting
 * hit rate. Ignores referrals (which also cost energy) and week-to-week
 * randomness, so the real peak sits a little below it.
 */
export function sustainablePace(P: Params): number {
  const p = P.p0;
  const q = Math.min(P.q, 1 - p);
  const cost = (1 - p - q) * ENERGY_DUD + q * ENERGY_LOSS - p * ENERGY_HIT_BONUS;
  return cost > 0 ? ENERGY_RECOVER / cost : Infinity;
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
