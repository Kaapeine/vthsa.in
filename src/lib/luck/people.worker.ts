// Runs the "Many people" population off the main thread. Phase 1 posts one
// roll per person (fast); phase 2 posts the full roll statistics in batches.

import { simulate, type Params } from './simulation';
import { drawPeople, personParams, personSeed, runPerson, type PersonResult, type VarySpec } from './people';

export interface PeopleRequest {
  base: Params;
  specs: VarySpec[];
  n: number;
  rolls: number;
  seed: number;
}

export type PeopleMessage =
  | { type: 'people'; vals: number[][]; first: number[] }
  | { type: 'rolls'; from: number; results: PersonResult[] }
  | { type: 'done' };

const post = (m: PeopleMessage) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<PeopleRequest>) => {
  const { base, specs, n, rolls, seed } = e.data;
  const vals = drawPeople(base, specs, n, seed);
  const params = vals.map((v) => personParams(base, specs, v));
  const first = params.map((P, i) => simulate(P, 1, personSeed(seed, i)).finals[0]);
  post({ type: 'people', vals, first });

  const BATCH = 8;
  for (let from = 0; from < n; from += BATCH) {
    const results: PersonResult[] = [];
    for (let i = from; i < Math.min(n, from + BATCH); i++) results.push(runPerson(params[i], rolls, personSeed(seed, i)));
    post({ type: 'rolls', from, results });
  }
  post({ type: 'done' });
};
