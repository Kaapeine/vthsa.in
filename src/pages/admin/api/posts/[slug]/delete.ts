import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../../lib/auth';
import { getFile, deleteFile } from '../../../../../lib/github';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const slug = params.slug;
  const path = `src/content/blog/${slug}.md`;
  try {
    const file = await getFile(path);
    if (!file) {
      return redirect('/admin?error=' + encodeURIComponent('Post not found.'));
    }
    await deleteFile(path, file.sha, `Delete post: ${slug}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return redirect('/admin?error=' + encodeURIComponent(`Couldn't delete — ${message}.`));
  }
  return redirect(
    '/admin?notice=' + encodeURIComponent('Deleted. Publishing now — live in ~1 minute.'),
  );
};

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
