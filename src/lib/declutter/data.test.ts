import { describe, it, expect } from 'vitest';
import { cullToBBox } from './data';
import type { Place, BBox } from './types';

const places: Place[] = [
  { id: 1, lng: 0, lat: 0, name: 'a', category: 'x' },
  { id: 2, lng: 10, lat: 10, name: 'b', category: 'x' },
  { id: 3, lng: -5, lat: 2, name: 'c', category: 'x' },
];

describe('cullToBBox', () => {
  it('keeps only places inside the bbox (inclusive edges)', () => {
    const bbox: BBox = { minLng: -1, minLat: -1, maxLng: 5, maxLat: 5 };
    expect(cullToBBox(places, bbox).map((p) => p.id)).toEqual([1]);
  });
  it('returns everything for a world bbox', () => {
    const bbox: BBox = { minLng: -180, minLat: -90, maxLng: 180, maxLat: 90 };
    expect(cullToBBox(places, bbox)).toHaveLength(3);
  });
});
