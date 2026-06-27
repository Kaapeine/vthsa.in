import { describe, it, expect } from 'vitest';
import { quadtree } from 'd3-quadtree';
import { visitWithin } from './quadtree';

type P = { id: number; dx: number; dy: number };

function tree(points: P[]) {
  return quadtree<P>().x((p) => p.dx).y((p) => p.dy).addAll(points);
}

describe('visitWithin', () => {
  it('returns only points inside the circle', () => {
    const pts: P[] = [
      { id: 1, dx: 0, dy: 0 },
      { id: 2, dx: 3, dy: 0 },   // dist 3 — inside r=5
      { id: 3, dx: 10, dy: 0 },  // dist 10 — outside
      { id: 4, dx: 0, dy: 4 },   // dist 4 — inside
    ];
    const found: number[] = [];
    visitWithin(tree(pts), 0, 0, 5, (p) => found.push(p.id));
    expect(found.sort()).toEqual([1, 2, 4]);
  });

  it('finds nothing when the circle is empty', () => {
    const found: number[] = [];
    visitWithin(tree([{ id: 1, dx: 100, dy: 100 }]), 0, 0, 5, (p) => found.push(p.id));
    expect(found).toEqual([]);
  });
});
