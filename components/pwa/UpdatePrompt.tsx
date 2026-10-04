'use client';

/**
 * "A new version is ready."
 *
 * AIBOS ships several times a day. A browser tab or an installed app that was
 * opened this morning keeps running the version it loaded, so an owner can be
 * looking at old screens while the fix they asked for is already live.
 *
 * HOW A NEW VERSION IS SEEN. This used to wait for a new service worker, but
 * public/sw.js only changes when its VERSION is bumped by hand, so an ordinary
 * deploy never produced one and installed apps never heard about updates.
 * Now the app knows which build it is (NEXT_PUBLIC_BUILD_SHA, fixed at build
 * time) and asks /api/version which build is live:
 *   - when it opens, and every time it comes back to the front (an installed
 *     app on a phone is resumed far more often than it is reloaded)
 *   - every 5 minutes while it stays open
 * A new service worker taking over still counts too.
 *
 * WHAT THE OWNER SEES. A bar with "Get it now", which reloads into the new
 * version. "Later" hides it until the app is next opened. In the installed
 * app, when a new version lands while AIBOS is in the background and
 * notifications are allowed, the device also shows one notification per
 * version; tapping it brings AIBOS forward on the new version (the service
 * worker's notificationclick navigates the window, which loads fresh pages).
 */

import { useCallback, useEffect, useState } from 'react';

const CHECK_MS = 5 * 60 * 1000;
const RUNNING = process.env.NEXT_PUBLIC_BUILD_SHA || 'dev';
const NOTIFIED_KEY = 'aibos-update-notified';
const LATER_KEY = 'aibos-update-later';

const installed = () =>
  typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true);

async function notifyDevice(build: string): Promise<void> {
  try {
    if (!installed() || !document.hidden) return;              // on screen: the bar says it
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (window.localStorage.getItem(NOTIFIED_KEY) === build) return;   // once per version
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) return;
    await reg.showNotification('AIBOS has a new version', {
      body: 'Tap to open AIBOS on the new version.',
      tag: 'aibos-update',
      icon: '/icons/notify-192.png',
      badge: '/icons/badge-96.png',
      data: { link: window.location.pathname + window.location.search },
    });
    window.localStorage.setItem(NOTIFIED_KEY, build);
  } catch { /* notifications are a nicety; the bar still shows */ }
}

export default function UpdatePrompt() {
  const [ready, setReady] = useState(false);

  const offer = useCallback((build: string) => {
    // "Later" lasts until the app is next opened (sessionStorage), per version.
    let later = '';
    try { later = window.sessionStorage.getItem(LATER_KEY) ?? ''; } catch { /* private mode */ }
    if (later !== build) setReady(true);
    void notifyDevice(build);
  }, []);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      if (RUNNING === 'dev') return;                 // local builds have nothing to compare
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (alive && build && build !== 'dev' && build !== RUNNING) offer(build);
      } catch { /* offline: ask again later */ }
    };

    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = window.setInterval(() => { void check(); }, CHECK_MS);

    // A new service worker taking over is a new version too.
    let onChange: (() => void) | null = null;
    if ('serviceWorker' in navigator) {
      const hadOne = Boolean(navigator.serviceWorker.controller);
      onChange = () => { if (hadOne) offer('service-worker'); };
      navigator.serviceWorker.addEventListener('controllerchange', onChange);
      void navigator.serviceWorker.getRegistration().then((reg) => {
        if (hadOne && reg?.waiting) offer('service-worker');
        void reg?.update().catch(() => { /* offline */ });
      }).catch(() => { /* no service worker on this browser */ });
    }

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(timer);
      if (onChange) navigator.serviceWorker.removeEventListener('controllerchange', onChange);
    };
  }, [offer]);

  if (!ready) return null;

  const later = () => {
    setReady(false);
    // Remember for this session only; the next launch asks again.
    void fetch('/api/version', { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ build }: { build?: string }) => { try { if (build) window.sessionStorage.setItem(LATER_KEY, build); } catch { /* private mode */ } })
      .catch(() => { /* offline */ });
  };

  return (
    <div className="update-bar" role="status">
      <span className="update-words">A new version of AIBOS is ready.</span>
      <button type="button" className="update-button" onClick={() => window.location.reload()}>
        Get it now
      </button>
      <button type="button" className="update-later" onClick={later}>
        Later
      </button>
    </div>
  );
}
