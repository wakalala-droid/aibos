/* AI-BOS service worker — deliberately conservative.
 *
 * Strategy (Devil's-Advocate-approved to avoid the classic stale-cache trap):
 *  - Hashed static assets (/_next/static, icons, brand, fonts): cache-first.
 *    They're content-addressed or effectively immutable — safe forever.
 *  - Page navigations: network-first with the static offline page as the
 *    LAST resort. HTML is never served stale from cache.
 *  - Everything else (API calls, auth, data): untouched. The offline outbox
 *    in lib/outbox.ts handles data writes — the SW never buffers API traffic.
 */

const VERSION = 'aibos-sw-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/fonts/')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Immutable static assets: cache-first.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Page navigations: network-first, offline page as last resort.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
  // All other requests (API, auth, data): pass through untouched.
});
