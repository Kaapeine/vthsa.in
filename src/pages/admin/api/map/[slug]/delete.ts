import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../../lib/auth';
import { getFile, deleteFile } from '../../../../../lib/github';
import { isValidSlug } from '../../../../../lib/content';
import { tagImagePath, tagPath } from '../../../../../lib/map';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const slug = params.slug;
  if (!slug || !isValidSlug(slug)) {
    return redirect('/admin?error=' + encodeURIComponent('Invalid tag slug.'));
  }

  try {
    const file = await getFile(tagPath(slug));
    if (!file) {
      return redirect('/admin?error=' + encodeURIComponent('Tag not found.'));
    }
    await deleteFile(tagPath(slug), file.sha, `Delete map tag: ${slug}`);

    const image = await getFile(tagImagePath(slug));
    if (image) {
      await deleteFile(tagImagePath(slug), image.sha, `Delete map image: ${slug}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return redirect('/admin?error=' + encodeURIComponent(`Couldn't delete — ${message}.`));
  }

  return redirect('/admin?notice=' + encodeURIComponent('Tag deleted. Publishing now — live in ~1 minute.'));
};

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
