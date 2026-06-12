import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { getFile, putFile } from '../../../lib/github';
import {
  buildPostFile,
  isValidSlug,
  parseTags,
  slugify,
  todayIso,
  type PostInput,
} from '../../../lib/content';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const mode = String(form.get('mode') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();
  const tags = parseTags(String(form.get('tags') ?? ''));

  if (!title || !description || !body) {
    return fail(mode, form, 'Title, description, and body are required.');
  }

  try {
    if (mode === 'create') {
      const slug = slugify(title);
      if (!slug) return fail('create', form, 'Title produces an empty slug.');
      const path = `src/content/blog/${slug}.md`;
      const existing = await getFile(path);
      if (existing) return fail('create', form, 'A post with that title already exists.');
      const input: PostInput = {
        title,
        description,
        body,
        tags,
        pubDate: String(form.get('pubDate') ?? todayIso()),
      };
      await putFile(path, buildPostFile(input), `Add post: ${slug}`);
    } else if (mode === 'update') {
      const slug = String(form.get('slug') ?? '');
      if (!isValidSlug(slug)) return fail('update', form, 'Invalid post slug.', slug);
      const path = `src/content/blog/${slug}.md`;
      const current = await getFile(path);
      if (!current) return fail('update', form, 'Post no longer exists.', slug);
      const input: PostInput = {
        title,
        description,
        body,
        tags,
        pubDate: String(form.get('pubDate') ?? todayIso()),
        updatedDate: todayIso(),
      };
      await putFile(path, buildPostFile(input), `Update post: ${slug}`, current.sha);
    } else {
      return fail(mode, form, 'Unknown form mode.');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return fail(mode, form, `Couldn't save — ${message}. Nothing was published.`);
  }

  return redirect(
    '/admin?notice=' + encodeURIComponent('Saved. Publishing now — live in ~1 minute.'),
  );
};

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

function fail(mode: string, form: FormData, message: string, slug?: string): Response {
  const back =
    mode === 'update'
      ? `/admin/edit/${slug ?? form.get('slug')}`
      : '/admin/new';
  return redirect(`${back}?error=${encodeURIComponent(message)}`);
}
