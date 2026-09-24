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
// white logo; v3: notifications got their own picture and badge; v4: the
// reminder tone is kept at install time; v5: AIBOS's own tone replaces the
// device's sound while it is open), so installed apps drop the old copies.
const VERSION = 'aibos-sw-v5';
const OFFLINE_URL = '/offline.html';
// Taken when AIBOS is added to a Home Screen, so the tone belongs to the
// installed app and plays with no signal.
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png',
  '/icons/notify-192.png', '/icons/badge-96.png', '/sounds/reminder.mp3'];

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
    url.pathname.startsWith('/sounds/') ||
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
 *
 * THE SOUND IS AIBOS'S OWN WHEREVER IT CAN BE. No website can choose the sound
 * a device plays for a notification (the Notification API's `sound` was never
 * built by any browser), but it can ask an open AIBOS to play the tone and then
 * keep the notification itself quiet, so the owner hears AIBOS and not the
 * device. One window is asked, the one in front, and the answer decides:
 *
 *   played  -> the notification is silent, because the tone was already heard
 *   not     -> the notification makes the device's usual sound, so that
 *              nothing arrives in silence
 *
 * A phone freezes a window that is not on screen, so on a phone only a window
 * ON SCREEN is asked. A computer plays audio from a window behind others, so
 * any window there will do. With AIBOS closed there is nobody to ask and the
 * device's own sound is what there is.
 */
const ON_A_PHONE = /Android|iPhone|iPad|iPod/i.test((self.navigator && self.navigator.userAgent) || '');
const PLAY_ANSWER_MS = 1500;

function windowToAsk(windows) {
  return windows.find((c) => c.visibilityState === 'visible' && c.focused)
    || windows.find((c) => c.visibilityState === 'visible')
    || (ON_A_PHONE ? undefined : windows[0]);
}

/** Ask one window to play the tone. True only when it says it did. */
function askToPlay(client, message) {
  return new Promise((resolve) => {
    let answered = false;
    const finish = (played) => { if (!answered) { answered = true; resolve(played); } };
    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => finish(Boolean(event.data && event.data.played));
      setTimeout(() => finish(false), PLAY_ANSWER_MS);
      client.postMessage(message, [channel.port2]);
    } catch (e) {
      finish(false);
    }
  });
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'AIBOS';
  const link = data.link || '/dashboard';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }).catch(() => []);
    const open = windowToAsk(windows);
    const played = open
      ? await askToPlay(open, { type: 'aibos-notification', title, tag: data.tag || '', link })
      : false;
    await self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/notify-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || link || 'aibos',
      renotify: true,
      requireInteraction: Boolean(data.sticky),
      silent: played,
      vibrate: !played && data.sticky ? [200, 100, 200] : undefined,
      data: { link },
    });
  })());
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
