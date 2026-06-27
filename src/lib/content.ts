import matter from 'gray-matter';

export interface PostInput {
  title: string;
  description?: string;
  body: string;
  tags: string[];
  pubDate: string; // ISO YYYY-MM-DD
  updatedDate?: string; // ISO YYYY-MM-DD, set on edits
  draft?: boolean;
}

export interface LibraryLink {
  title: string;
  url: string;
  description: string;
  tags: string[];
  date?: string; // ISO YYYY-MM-DD
}

/** Convert a title into a filesystem/url-safe slug. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * True if a slug is safe to use in a content file path. Restricts to the same
 * character set `slugify` produces, so a slug can never traverse outside
 * src/content/blog/ when interpolated into a GitHub API path.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}

/** Today's date as ISO YYYY-MM-DD (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build a post markdown file (frontmatter + body) from form input. */
export function buildPostFile(input: PostInput): string {
  const data: Record<string, unknown> = {
    title: input.title,
    pubDate: input.pubDate,
  };
  if (input.description) data.description = input.description;
  if (input.updatedDate) data.updatedDate = input.updatedDate;
  if (input.tags.length > 0) data.tags = input.tags;
  if (input.draft) data.draft = true;
  // gray-matter.stringify serializes `data` as YAML frontmatter above the body.
  return matter.stringify(input.body, data);
}

/** Parse an existing post file into editable fields. */
export function parsePostFile(raw: string): PostInput {
  const { data, content } = matter(raw);
  const toIso = (v: unknown): string => {
    if (!v) return '';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
  };
  return {
    title: String(data.title ?? ''),
    description: data.description ? String(data.description) : undefined,
    body: content.replace(/^\n/, ''),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    pubDate: toIso(data.pubDate),
    updatedDate: data.updatedDate ? toIso(data.updatedDate) : undefined,
    draft: data.draft === true ? true : undefined,
  };
}

/** Parse links.md into its links array. Throws if the structure is unexpected. */
export function parseLinksFile(raw: string): LibraryLink[] {
  const { data } = matter(raw);
  if (!data || !Array.isArray(data.links)) {
    throw new Error('links.md is malformed: expected a top-level `links` array');
  }
  return data.links as LibraryLink[];
}

/** Serialize a links array back into links.md (empty body, links in frontmatter). */
export function buildLinksFile(links: LibraryLink[]): string {
  return matter.stringify('', { links });
}

/** Comma-separated string -> trimmed, de-duplicated, non-empty tag array. */
export function parseTags(input: string): string[] {
  return [...new Set(input.split(',').map((t) => t.trim()).filter(Boolean))];
}
