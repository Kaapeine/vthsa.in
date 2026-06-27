import { describe, it, expect } from 'vitest';
import { colorForCategory } from './palette';

describe('colorForCategory', () => {
  it('returns an RGB triple with channels in [0,1]', () => {
    const c = colorForCategory('ruins');
    expect(c).toHaveLength(3);
    for (const ch of c) {
      expect(ch).toBeGreaterThanOrEqual(0);
      expect(ch).toBeLessThanOrEqual(1);
    }
  });
  it('is deterministic for the same category', () => {
    expect(colorForCategory('museum')).toEqual(colorForCategory('museum'));
  });
  it('differs between most categories', () => {
    expect(colorForCategory('museum')).not.toEqual(colorForCategory('cemetery'));
  });
});
