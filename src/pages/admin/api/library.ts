import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { getFile, putFile } from '../../../lib/github';
import {
  buildLinksFile,
  parseLinksFile,
  parseTags,
  type LibraryLink,
} from '../../../lib/content';

export const prerender = false;

const LINKS_PATH = 'src/content/library/links.md';

export const POST: APIRoute = async ({ request }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const url = String(form.get('url') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const tags = parseTags(String(form.get('tags') ?? ''));
  const dateRaw = String(form.get('date') ?? '').trim();
  const date = dateRaw || undefined;

  if (!title || !url || !description) {
    return fail('Title, URL, and description are required.');
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return fail('URL is not valid.');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return fail('URL must start with http:// or https://.');
  }

  try {
    const file = await getFile(LINKS_PATH);
    if (!file) return fail('links.md not found in the repo.');
    const existing = parseLinksFile(file.text);
    const next: LibraryLink[] = [{ title, url, description, tags, date }, ...existing];
    await putFile(LINKS_PATH, buildLinksFile(next), `Add library link: ${title}`, file.sha);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return fail(`Couldn't add link — ${message}. Nothing was published.`);
  }

  return redirect(
    '/admin?notice=' + encodeURIComponent('Link added. Publishing now — live in ~1 minute.'),
  );
};

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

function fail(message: string): Response {
  return redirect('/admin/library/new?error=' + encodeURIComponent(message));
}
