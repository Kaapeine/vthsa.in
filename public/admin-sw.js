// Admin PWA service worker.
//
// Scope is restricted to /admin (see registration in AdminLayout.astro), so this
// never touches the public blog. It deliberately does NOT cache admin pages or
// API responses — the admin is auth-gated and writes to a live backend, so
// serving stale content or replaying POSTs offline would be actively harmful.
//
// Its only jobs: (1) exist, so Chrome on Android offers "Install app", and
// (2) show a friendly offline notice instead of the browser dino when a
// navigation fails. Everything else passes straight through to the network.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline · admin</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background:#111; color:#eee; display:grid; place-content:center;
    min-height:100vh; margin:0; text-align:center; padding:1rem; }
  button { font:inherit; background:#1b1b1b; color:#eee; border:1px solid #444;
    border-radius:4px; padding:0.6rem 1rem; cursor:pointer; margin-top:1rem; }
</style></head><body>
  <div>
    <h1>You're offline</h1>
    <p>The admin needs a connection to load.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body></html>`;

self.addEventListener('fetch', (event) => {
  // Only intercept top-level navigations so we can offer an offline fallback.
  // All other requests (assets, API, form POSTs) are left to the browser's
  // default network handling — no caching, no interception.
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
    )
  );
});
