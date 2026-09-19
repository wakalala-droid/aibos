/* AIBOS service worker — deliberately conservative.
 *
 * Strategy (Devil's-Advocate-approved to avoid the classic stale-cache trap):
 *  - Hashed static assets (/_next/static, icons, brand, fonts): cache-first.
 *    They're content-addressed or effectively immutable — safe forever.
 *  - Page navigations: network-first with the static offline page as the
 *    LAST resort. HTML is never served stale from cache.
 *  - Everything else (API calls, auth, data): untouched. The offline outbox
 *    in lib/outbox.ts handles data writes — the SW never buffers API traffic.
 */

// Bumped whenever a cached asset changes in place (v2: the icons became the
// white logo), so installed apps drop the old copies.
const VERSION = 'aibos-sw-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png'];

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

/* ── Notifications on the phone (upgrade 10) ───────────────────────────────
 * The API sends an encrypted message; the browser hands it here and this
 * shows it, even with AIBOS closed. Tapping it opens the page the alert is
 * about, reusing an open AIBOS window when there is one.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'AIBOS';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.link || 'aibos',
      renotify: true,
      data: { link: data.link || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const link = (event.notification.data && event.notification.data.link) || '/dashboard';
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    })
  );
});
