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
// white logo; v3: notifications got their own picture and badge), so
// installed apps drop the old copies.
const VERSION = 'aibos-sw-v3';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png',
  '/icons/notify-192.png', '/icons/badge-96.png'];

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
 *
 * The picture is the logo on its dark tile (the plain app icon is white on
 * clear and vanished on a light notification shade). The badge is the mark's
 * white outline, because Android draws a badge from its shape alone. A
 * message's own `tag` keeps two reminders from replacing each other, and
 * `sticky` (schedule reminders) keeps it on screen until it is dealt with.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'AIBOS';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/notify-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || data.link || 'aibos',
      renotify: true,
      requireInteraction: Boolean(data.sticky),
      vibrate: data.sticky ? [200, 100, 200] : undefined,
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
