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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Replaces Astro's built-in checkOrigin (disabled in astro.config.mjs because it
// can't see the real protocol behind Railway's TLS-terminating proxy). We compare
// the Origin *host* against the request host, ignoring protocol — the proxy
// preserves Host but forwards plain http to the app, so a protocol comparison
// would always fail. Combined with the SameSite=Strict admin cookie, this blocks
// cross-site state-changing requests.
function isTrustedOrigin(context: { request: Request; url: URL }): boolean {
  const origin = context.request.headers.get('origin');
  // Browsers omit Origin on some same-origin navigations. The admin session
  // cookie is SameSite=Strict, so a forged cross-site request can't carry it.
  if (!origin) return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  if (host === context.url.host) return true;
  const forwardedHost = context.request.headers.get('x-forwarded-host');
  if (forwardedHost && host === forwardedHost.split(',')[0].trim()) return true;
  const extra = (process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(host);
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Handle CORS preflight requests
  if (context.request.method === 'OPTIONS') {
    const headers = new Headers({ 'Access-Control-Max-Age': '86400' });
    applyCors(headers);
    return new Response(null, { status: 204, headers });
  }

  // CSRF: reject cross-site state-changing requests (replaces Astro checkOrigin).
  if (!SAFE_METHODS.has(context.request.method) && !isTrustedOrigin(context)) {
    return new Response('Cross-site request forbidden', { status: 403 });
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
