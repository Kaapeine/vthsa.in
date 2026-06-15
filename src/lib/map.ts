import matter from 'gray-matter';
import { categoryById } from './categories';

export interface TagInput {
  title: string;
  category: string;
  lat: number;
  lng: number;
  /** Image filename only (e.g. "old-banyan-tree.jpg"), or undefined when there is no photo. */
  image?: string;
  /** Free-text notes — stored as the markdown body. Optional. */
  notes?: string;
  /** ISO YYYY-MM-DD. */
  pubDate: string;
}

/** True if the given category id exists in the fixed list. */
export function isValidCategory(id: string): boolean {
  return categoryById(id) !== undefined;
}

/** Repo path to a tag's markdown file. */
export function tagPath(slug: string): string {
  return `src/content/map/${slug}.md`;
}

/** Repo path to a tag's committed image. */
export function tagImagePath(slug: string): string {
  return `public/map-images/${slug}.jpg`;
}

/** Public URL a committed tag image is served at. */
export function tagImageUrl(filename: string): string {
  return `/map-images/${filename}`;
}

/** Build a tag markdown file (frontmatter + notes body) from form input. */
export function buildTagFile(input: TagInput): string {
  const data: Record<string, unknown> = {
    title: input.title,
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    pubDate: input.pubDate,
  };
  if (input.image) data.image = input.image;
  // gray-matter.stringify serializes `data` as YAML frontmatter above the notes body.
  // Notes are optional; an empty body just produces frontmatter with no content below.
  return matter.stringify(input.notes ?? '', data);
}

/** Parse an existing tag file into editable fields. */
export function parseTagFile(raw: string): TagInput {
  const { data, content } = matter(raw);
  const toIso = (v: unknown): string => {
    if (!v) return '';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
  };
  return {
    title: String(data.title ?? ''),
    category: String(data.category ?? ''),
    lat: Number(data.lat),
    lng: Number(data.lng),
    image: data.image ? String(data.image) : undefined,
    notes: content.replace(/^\n/, ''),
    pubDate: toIso(data.pubDate),
  };
}
