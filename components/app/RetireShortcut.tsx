'use client';

/**
 * The old shortcut's screen (owner, 21 Oct 2026: "after they're done
 * downloading it, delete the shortcut version from the browser").
 *
 * A website cannot remove a home-screen icon itself; only the owner can, with
 * a long press. So whenever AIBOS is opened from the shortcut the browser made
 * (Install app, Add to Home Screen), this screen comes up first:
 *   - no app yet: get it, with the steps, ending in "remove this icon"
 *   - the app is on the phone (it has opened here, or Chrome says so):
 *     open it, and remove this icon
 * "Continue here for now" lets them work this once; it asks again the next
 * time the shortcut opens, until the icon is gone.
 *
 * An iPhone sees it only once the App Store link is set (IOS_APP_URL).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { NoticeArt } from '@/components/kit';
import AndroidSteps from './AndroidSteps';
import { ApkLink } from './GetAndroidApp';
import { ANDROID_APP, IOS_APP_URL, androidAppLink, device, hasAndroidApp, inBrowserShortcut } from '@/lib/nativeApp';

const LATER_KEY = 'aibos-shortcut-later';   // sessionStorage: this launch only

type State = 'android-get' | 'android-have' | 'ios-get' | null;

export default function RetireShortcut() {
  const pathname = usePathname() || '';
  const [state, setState] = useState<State>(null);
  const [downloaded, setDownloaded] = useState(false);
  const first = useRef<HTMLAnchorElement>(null);

  const check = useCallback(async () => {
    if (!inBrowserShortcut()) { setState(null); return; }
    try { if (window.sessionStorage.getItem(LATER_KEY) === '1') { setState(null); return; } } catch { /* private mode */ }
    const d = device();
    if (d === 'android') setState((await hasAndroidApp()) ? 'android-have' : 'android-get');
    else if (d === 'ios' && IOS_APP_URL) setState('ios-get');
    else setState(null);
  }, []);

  useEffect(() => {
    void check();
    // Back from installing: the app has opened by now and left its mark in the
    // storage it shares with this shortcut.
    const back = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [check]);

  const later = useCallback(() => {
    try { window.sessionStorage.setItem(LATER_KEY, '1'); } catch { /* private mode */ }
    setState(null);
  }, []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') later(); };
    window.addEventListener('keydown', onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    first.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [state, later]);

  if (!state) return null;

  const title = state === 'android-have' ? 'Remove this old shortcut'
    : state === 'ios-get' ? 'AIBOS has its own iPhone app now' : 'AIBOS has its own app now';
  const sub = state === 'android-have'
    ? 'The AIBOS app is on your phone. This icon is the shortcut the browser made before, so you no longer need it.'
    : 'This icon is a shortcut the browser made. The AIBOS app replaces it: full screen, with alerts and shortcuts, and every update arrives by itself.';

  return (
    <div className="whatsnew-backdrop" style={{ zIndex: 96 }}>
      <div className="whatsnew retire-shortcut" role="dialog" aria-modal="true" aria-labelledby="retire-title" style={{ width: 'min(640px, 100%)' }}>
        <NoticeArt />
        <div className="whatsnew-body">
          <div>
            <p className="eyebrow">{state === 'ios-get' ? 'iPhone' : 'Android'}</p>
            <h2 id="retire-title" className="whatsnew-title">{title}</h2>
            <p className="whatsnew-sub" style={{ marginTop: 8 }}>{sub}</p>
          </div>

          {state === 'android-get' && <AndroidSteps downloaded={downloaded} shortcut="here" />}
          {state === 'android-have' && (
            <ol className="app-steps">
              <li>
                <span className="step-title">Open the AIBOS app</span>
                <span className="step-text">Tap the button below, or the new AIBOS icon. You stay signed in.</span>
              </li>
              <li>
                <span className="step-title">Remove this shortcut</span>
                <span className="step-text">
                  Press and hold the AIBOS icon you opened this from, then tap <strong>Uninstall</strong> or <strong>Remove</strong>. Your account and your books stay exactly as they are.
                </span>
              </li>
            </ol>
          )}
          {state === 'ios-get' && (
            <ol className="app-steps">
              <li>
                <span className="step-title">Get AIBOS from the App Store</span>
                <span className="step-text">Tap the button below, then <strong>Get</strong>.</span>
              </li>
              <li>
                <span className="step-title">Open it</span>
                <span className="step-text">Sign in with Google once and you are back on your business.</span>
              </li>
              <li>
                <span className="step-title">Remove this shortcut</span>
                <span className="step-text">Press and hold the AIBOS icon you opened this from and remove it. Your account and your books stay exactly as they are.</span>
              </li>
            </ol>
          )}

          <div className="retire-actions">
            {state === 'android-get' && (
              <ApkLink linkRef={first} className={downloaded ? 'pill pill-quiet' : 'pill pill-primary'} onDownload={() => setDownloaded(true)}>
                {downloaded ? 'Download again' : `Download the app (${ANDROID_APP.size})`}
              </ApkLink>
            )}
            {state === 'android-have' && (
              <a ref={first} href={androidAppLink(pathname)} className="pill pill-primary">Open the AIBOS app</a>
            )}
            {state === 'ios-get' && (
              <a ref={first} href={IOS_APP_URL} className="pill pill-primary" rel="noopener">Get the iPhone app</a>
            )}
            <button type="button" className="pill pill-quiet" onClick={later}>Continue here for now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
