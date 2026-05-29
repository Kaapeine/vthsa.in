import type { APIRoute } from 'astro';
import {
  checkPassword,
  createSessionCookie,
  isLockedOut,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');

  if (isLockedOut()) {
    return redirectWithError('Too many attempts. Try again later.');
  }
  if (!checkPassword(password)) {
    recordFailedLogin();
    return redirectWithError('Incorrect password.');
  }
  recordSuccessfulLogin();
  return new Response(null, {
    status: 303,
    headers: { Location: '/admin', 'Set-Cookie': createSessionCookie() },
  });
};

function redirectWithError(message: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/admin?error=${encodeURIComponent(message)}` },
  });
}
