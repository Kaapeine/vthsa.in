export interface Category {
  /** Stable id stored in tag frontmatter. Lowercase, no spaces. */
  id: string;
  /** Human-readable name shown in the dropdown and legend. */
  label: string;
  /** Emoji used as the map marker icon and legend glyph. */
  emoji: string;
  /** Hex color, reserved for future styling. */
  color: string;
}

// Edit this list to add/remove categories. Every tag's `category` must match one id here.
export const categories: Category[] = [
  { id: 'nature', label: 'Nature', emoji: '🌳', color: '#4caf50' },
  { id: 'food', label: 'Food', emoji: '🌯', color: '#ff9800' },
  { id: 'smokeshop', label: 'Sutta', emoji: '🚬', color: '#737676' },
  { id: 'easteregg', label: 'Easter Egg', emoji: '🌀', color: '#03a9f4' },
  { id: 'houses', label: 'Houses', emoji: '🛖', color: '#9c27b0' },
  { id: 'art', label: 'Street art', emoji: '🎨', color: '#e91e63' },
  { id: 'cat', label: 'Cat', emoji: '🐱', color: '#00bcd4' },
  { id: 'dog', label: 'Dog', emoji: '🐶', color: '#00d47f' },
];

const byId = new Map(categories.map((c) => [c.id, c]));

/** Look up a category by id, or undefined if it does not exist. */
export function categoryById(id: string): Category | undefined {
  return byId.get(id);
}
