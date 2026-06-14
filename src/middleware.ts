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
  const req = context.request;

  // PRIMARY signal: Sec-Fetch-Site (Fetch Metadata). It is set by the browser,
  // cannot be forged by JS (a forbidden header), and — unlike Origin — is NOT
  // affected by Referrer-Policy. Firefox sends `Origin: null` on a form POST
  // when the page's Referrer-Policy is `no-referrer`, even for same-origin
  // submissions, which is exactly what broke us. Sec-Fetch-Site still correctly
  // reports `same-origin`. Reject only genuinely cross-site requests.
  const site = req.headers.get('sec-fetch-site');
  if (site) {
    // same-origin = from our own page; same-site = our subdomain; none =
    // user-initiated (typed URL, bookmark). Only cross-site is a CSRF risk.
    if (site !== 'cross-site') return true;
    logReject(context, `sec-fetch-site=${site}`);
    return false;
  }

  // FALLBACK for browsers without Fetch Metadata: explicit Origin allowlist +
  // protocol-agnostic same-host check. We never reconstruct `url.origin`, so
  // this is immune to the X-Forwarded-Proto problem behind Railway's proxy.
  const origin = req.headers.get('origin');
  // Absent or opaque (`null`) Origin: the SameSite=Strict admin cookie already
  // prevents a forged cross-site request from carrying credentials.
  if (!origin || origin === 'null') return true;
  if (trustedOrigins().includes(origin)) return true;
  try {
    const originHost = new URL(origin).host;
    if (originHost === context.url.host) return true;
    const forwardedHost = req.headers.get('x-forwarded-host');
    if (forwardedHost && originHost === forwardedHost.split(',')[0].trim()) return true;
  } catch {
    /* fall through to reject */
  }
  logReject(context, `origin=${origin}`);
  return false;
}

// Logs rejections with the real request headers so a production miss is
// diagnosable from Railway logs (what did the browser/proxy actually send?).
function logReject(context: { request: Request; url: URL }, reason: string): void {
  console.error('[csrf] rejected', {
    reason,
    method: context.request.method,
    path: context.url.pathname,
    origin: context.request.headers.get('origin'),
    secFetchSite: context.request.headers.get('sec-fetch-site'),
    urlHost: context.url.host,
    xForwardedHost: context.request.headers.get('x-forwarded-host'),
  });
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
    // `same-origin` (not `no-referrer`): still sends no referrer to external
    // sites, but lets same-origin form POSTs keep a proper Origin header.
    // `no-referrer` made Firefox send `Origin: null`, tripping the CSRF check.
    newHeaders.set('Referrer-Policy', 'same-origin');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
});
