import { defineMiddleware } from 'astro:middleware';

// Applies CORS headers only when ALLOWED_ORIGIN is configured. Skipping them
// when it is unset avoids emitting a meaningless `Access-Control-Allow-Origin:
// undefined` header (the prior behavior).
function applyCors(headers: Headers): void {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (!allowedOrigin) return;
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Handle CORS preflight requests
  if (context.request.method === 'OPTIONS') {
    const headers = new Headers({ 'Access-Control-Max-Age': '86400' });
    applyCors(headers);
    return new Response(null, { status: 204, headers });
  }

  // Get the response from next middleware/route
  const response = await next();
  const newHeaders = new Headers(response.headers);
  applyCors(newHeaders);

  // Prevent the admin from being framed (clickjacking) on any /admin route.
  if (context.url.pathname.startsWith('/admin')) {
    newHeaders.set('Content-Security-Policy', "frame-ancestors 'none'");
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('Referrer-Policy', 'no-referrer');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
});
