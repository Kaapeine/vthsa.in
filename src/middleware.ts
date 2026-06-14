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

// Marker so we can confirm in production which build is actually live (Railway
// can serve a cached/old build). Bump on every change to the CSRF logic.
const CSRF_CHECK_VERSION = 'v2';

// Public origins permitted to make state-changing requests. We check the
// browser's Origin header DIRECTLY against this set — we never reconstruct
// `url.origin`, so this is immune to the X-Forwarded-Proto problem that breaks
// Astro's built-in checkOrigin behind Railway's TLS-terminating proxy (the app
// sees http while the browser's Origin is https). Add extra origins via the
// TRUSTED_ORIGINS env var (comma-separated, full origin incl. scheme).
const STATIC_TRUSTED_ORIGINS = ['https://vthsa.in', 'https://www.vthsa.in'];

function trustedOrigins(): string[] {
  const extra = (process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...STATIC_TRUSTED_ORIGINS, ...extra];
}

// Replaces Astro's built-in checkOrigin (disabled in astro.config.mjs).
function isTrustedOrigin(context: { request: Request; url: URL }): boolean {
  const origin = context.request.headers.get('origin');
  // Browsers omit Origin on some same-origin navigations. The admin session
  // cookie is SameSite=Strict, so a forged cross-site request can't carry it.
  if (!origin) return true;
  // Exact match against the known public origins (scheme included).
  if (trustedOrigins().includes(origin)) return true;
  // Same-origin fallback: compare hosts (protocol-agnostic) so the Railway
  // *.up.railway.app domain, preview URLs, and localhost dev all work without
  // configuration. Railway preserves the public host in Host or x-forwarded-host.
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  if (originHost === context.url.host) return true;
  const forwardedHost = context.request.headers.get('x-forwarded-host');
  if (forwardedHost && originHost === forwardedHost.split(',')[0].trim()) return true;
  // Rejected: log the real headers so a production miss is diagnosable from
  // Railway logs (which host/origin did the proxy actually send?).
  console.error('[csrf] rejected cross-site request', {
    method: context.request.method,
    path: context.url.pathname,
    origin,
    urlHost: context.url.host,
    xForwardedHost: forwardedHost,
    xForwardedProto: context.request.headers.get('x-forwarded-proto'),
  });
  return false;
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
    return new Response(`Cross-site request forbidden (csrf ${CSRF_CHECK_VERSION})`, {
      status: 403,
      headers: { 'X-Csrf-Check': CSRF_CHECK_VERSION },
    });
  }

  // Get the response from next middleware/route
  const response = await next();
  const newHeaders = new Headers(response.headers);
  applyCors(newHeaders);
  // Deploy marker: lets us confirm from any response that this build is live.
  newHeaders.set('X-Csrf-Check', CSRF_CHECK_VERSION);

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
