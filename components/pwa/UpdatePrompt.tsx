'use client';

/**
 * "A new version is ready."
 *
 * AIBOS ships several times a day. A browser tab or an installed app that was
 * opened this morning keeps running the version it loaded, so an owner can be
 * looking at old screens while the fix they asked for is already live, and
 * nothing on screen says so.
 *
 * The service worker knows: when a new one takes over (it installs, calls
 * skipWaiting and claims the page), this bar appears and one tap reloads into
 * the new version. It only appears for a REPLACEMENT, never for the first
 * service worker of a fresh visit, which is not news to anybody.
 *
 * It also asks the browser to look for a new version every half hour, because
 * a tab left open all day would otherwise only check on the next navigation.
 */

import { useEffect, useState } from 'react';

const CHECK_MS = 30 * 60 * 1000;

export default function UpdatePrompt() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // No controller means this visit installed the first one: nothing to tell.
    const hadOne = Boolean(navigator.serviceWorker.controller);
    const onChange = () => { if (hadOne) setReady(true); };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);

    let timer = 0;
    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      // A worker already waiting when this page opened is a new version too.
      if (hadOne && reg.waiting) setReady(true);
      timer = window.setInterval(() => { void reg.update().catch(() => { /* offline */ }); }, CHECK_MS);
    }).catch(() => { /* no service worker on this browser */ });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      if (timer) window.clearInterval(timer);
    };
  }, []);

  if (!ready) return null;

  return (
    <div className="update-bar" role="status">
      <span className="update-words">A new version of AIBOS is ready.</span>
      <button type="button" className="update-button" onClick={() => window.location.reload()}>
        Get it now
      </button>
      <button type="button" className="update-later" onClick={() => setReady(false)} aria-label="Not now">
        Later
      </button>
    </div>
  );
}
