// Toys PWA service worker.
//
// Scope is restricted to /toys (see registration in ToyLayout.astro), so this
// never touches the rest of the site. It deliberately does NOT cache pages or
// assets — the toys are small and change often, and stale caches would just get
// in the way. Its only jobs: (1) exist, so Chrome on Android offers
// "Install app", and (2) show a friendly offline notice instead of the browser
// dino when a navigation fails. Everything else passes straight to the network.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline · toys</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background:#000; color:#eee; display:grid; place-content:center;
    min-height:100vh; margin:0; text-align:center; padding:1rem; }
  button { font:inherit; background:#111; color:#eee; border:1px solid #2337ff;
    border-radius:4px; padding:0.6rem 1rem; cursor:pointer; margin-top:1rem; }
</style></head><body>
  <div>
    <h1>You're offline</h1>
    <p>This toy needs a connection to load.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body></html>`;

self.addEventListener('fetch', (event) => {
  // Only intercept top-level navigations so we can offer an offline fallback.
  // All other requests (assets, fonts) are left to the browser's default
  // network handling — no caching, no interception.
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
