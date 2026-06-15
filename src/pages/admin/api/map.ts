import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { requireAuth } from '../../../lib/auth';
import { getFile, putFile, putBinaryFile, deleteFile } from '../../../lib/github';
import { isValidSlug, slugify, todayIso } from '../../../lib/content';
import {
  buildTagFile,
  isValidCategory,
  tagImagePath,
  tagPath,
  type TagInput,
} from '../../../lib/map';

export const prerender = false;

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB pre-resize cap

export const POST: APIRoute = async ({ request }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const mode = String(form.get('mode') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const category = String(form.get('category') ?? '').trim();
  const notes = String(form.get('notes') ?? '').trim();
  const latRaw = String(form.get('lat') ?? '').trim();
  const lngRaw = String(form.get('lng') ?? '').trim();

  if (!title) return fail(mode, form, 'Title is required.');
  if (!isValidCategory(category)) return fail(mode, form, 'Pick a valid category.');
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90)
    return fail(mode, form, 'Latitude is missing or out of range.');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180)
    return fail(mode, form, 'Longitude is missing or out of range.');

  const imageField = form.get('image');
  const hasImage = imageField instanceof File && imageField.size > 0;
  if (hasImage) {
    if (!imageField.type.startsWith('image/'))
      return fail(mode, form, 'Attached file is not an image.');
    if (imageField.size > MAX_UPLOAD_BYTES)
      return fail(mode, form, 'Image is too large (15 MB max).');
  }

  try {
    if (mode === 'create') {
      const slug = await uniqueSlug(slugify(title));
      if (!slug) return fail('create', form, 'Title produces an empty slug.');

      let imageName: string | undefined;
      if (hasImage) {
        const resized = await resizeImage(imageField as File);
        await putBinaryFile(tagImagePath(slug), resized, `Add map image: ${slug}`);
        imageName = `${slug}.jpg`;
      }

      const input: TagInput = { title, category, lat, lng, image: imageName, notes, pubDate: todayIso() };
      await putFile(tagPath(slug), buildTagFile(input), `Add map tag: ${slug}`);
    } else if (mode === 'update') {
      const slug = String(form.get('slug') ?? '');
      if (!isValidSlug(slug)) return fail('update', form, 'Invalid tag slug.', slug);

      const current = await getFile(tagPath(slug));
      if (!current) return fail('update', form, 'Tag no longer exists.', slug);

      const removeImage = form.get('removeImage') === 'true';
      let imageName = String(form.get('existingImage') ?? '').trim() || undefined;
      if (removeImage && imageName) {
        const existingImg = await getFile(tagImagePath(slug));
        if (existingImg) await deleteFile(tagImagePath(slug), existingImg.sha, `Delete map image: ${slug}`);
        imageName = undefined;
      } else if (hasImage) {
        const resized = await resizeImage(imageField as File);
        const existingImg = await getFile(tagImagePath(slug));
        await putBinaryFile(tagImagePath(slug), resized, `Update map image: ${slug}`, existingImg?.sha);
        imageName = `${slug}.jpg`;
      }

      const input: TagInput = {
        title, category, lat, lng, image: imageName, notes,
        pubDate: String(form.get('pubDate') ?? todayIso()),
      };
      await putFile(tagPath(slug), buildTagFile(input), `Update map tag: ${slug}`, current.sha);
    } else {
      return fail(mode, form, 'Unknown form mode.');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return fail(mode, form, `Couldn't save — ${message}. Nothing was published.`);
  }

  return redirect('/admin?notice=' + encodeURIComponent('Tag saved. Publishing now — live in ~1 minute.'));
};

async function resizeImage(file: File): Promise<Buffer> {
  const buf = Buffer.from(await file.arrayBuffer());
  return sharp(buf)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function uniqueSlug(base: string): Promise<string> {
  if (!base) return '';
  let slug = base;
  let n = 2;
  while (await getFile(tagPath(slug))) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

function fail(mode: string, form: FormData, message: string, slug?: string): Response {
  const back = mode === 'update'
    ? `/admin/map/edit/${slug ?? form.get('slug')}`
    : '/admin/map/new';
  return redirect(`${back}?error=${encodeURIComponent(message)}`);
}
