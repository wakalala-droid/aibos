/**
 * The AIBOS phone apps (owner, 21 Oct 2026): every Android user gets the AIBOS
 * app from this website, and the old browser shortcut goes once they have it.
 *
 * ANDROID. `website.aibos.app`, built by the private `aibos-android` repo: a
 * Trusted Web Activity, so it runs this website inside Chrome's engine, full
 * screen, with the same sign-in, storage, service worker and push alerts as
 * Chrome itself. The copy every visitor downloads is /download/AIBOS.apk; a new
 * build from that repo replaces the file and the version below.
 *
 * IPHONE. `aibos-ios` repo: the website in a native iPhone app. Apple lets no
 * website hand out an app file, so the iPhone app arrives through the App
 * Store (or a TestFlight link while it is in beta). Until that link is set in
 * NEXT_PUBLIC_IOS_APP_URL, iPhones keep Add to Home Screen.
 *
 * Which app a window is never needs React: APP_BOOT_SCRIPT runs before the
 * first paint on every page and marks <html> with data-device and data-app,
 * so the website's "Get the app" buttons show or hide with no flash
 * (globals.css, .when-android and .unless-android).
 */

export const ANDROID_APP = {
  package: 'website.aibos.app',
  apk: '/download/AIBOS.apk',
  /** aibos-android release build-2 (versionCode 2), 4,143,298 bytes. */
  version: '1.0.2',
  size: '4.1 MB',
} as const;

/** The App Store or TestFlight link, once Apple has the iPhone app. */
export const IOS_APP_URL = (process.env.NEXT_PUBLIC_IOS_APP_URL || '').trim();

/** localStorage: the Android app has opened on this phone. The app shares
 *  Chrome's storage, so the browser and the old shortcut see this too. */
export const ANDROID_APP_KEY = 'aibos-android-app';
/** sessionStorage: this window is one of the apps ('android' or 'ios'). */
const IN_APP_KEY = 'aibos-in-app';
/** The iPhone app adds this to its user agent (aibos-ios, AppWebView.swift). */
const IOS_APP_UA = /AIBOS-iOS\//;

/** Runs in <head> before anything paints. The Android app opens its first
 *  page with the referrer android-app://website.aibos.app; that is kept for
 *  the rest of the window's life, since later pages have the site itself as
 *  their referrer. */
export const APP_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,u=navigator.userAgent,s=window.sessionStorage,a='';
if(/^android-app:\\/\\/${ANDROID_APP.package.replace(/\./g, '\\.')}/.test(document.referrer))s.setItem('${IN_APP_KEY}','android');
if(${IOS_APP_UA}.test(u))s.setItem('${IN_APP_KEY}','ios');
a=s.getItem('${IN_APP_KEY}')||'';
if(/Android/i.test(u))d.setAttribute('data-device','android');
else if(/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))d.setAttribute('data-device','ios');
if(a){d.setAttribute('data-app',a);if(a==='android')window.localStorage.setItem('${ANDROID_APP_KEY}','1');}
}catch(e){}})();`;

export type Device = 'android' | 'ios' | 'other';

export function device(): Device {
  if (typeof document === 'undefined') return 'other';
  const marked = document.documentElement.getAttribute('data-device');
  return marked === 'android' || marked === 'ios' ? marked : 'other';
}

/** This window is the Android or iPhone app, not a browser. */
export function inApp(): 'android' | 'ios' | null {
  if (typeof document === 'undefined') return null;
  const app = document.documentElement.getAttribute('data-app');
  if (app === 'android' || app === 'ios') return app;
  return typeof navigator !== 'undefined' && IOS_APP_UA.test(navigator.userAgent) ? 'ios' : null;
}

/** Opened from a home-screen shortcut the browser made (Add to Home Screen,
 *  Install app), not from one of the apps. */
export function inBrowserShortcut(): boolean {
  if (typeof window === 'undefined' || inApp()) return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

interface RelatedApp { platform: string; id?: string }

/** Is the Android app on this phone? Known once it has opened here (shared
 *  storage), or asked of Chrome, which checks the app's link to this site
 *  (manifest related_applications, the app's asset_statements). */
export async function hasAndroidApp(): Promise<boolean> {
  try { if (window.localStorage.getItem(ANDROID_APP_KEY) === '1') return true; } catch { /* private mode */ }
  const ask = (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> }).getInstalledRelatedApps;
  if (!ask) return false;
  try {
    const apps = await ask.call(navigator);
    const found = apps.some((a) => a.id === ANDROID_APP.package);
    if (found) { try { window.localStorage.setItem(ANDROID_APP_KEY, '1'); } catch { /* private mode */ } }
    return found;
  } catch {
    return false;
  }
}

/** A link that opens a page of AIBOS in the Android app. Chrome hands it to
 *  the app, or opens the download page if the app has gone. */
export function androidAppLink(path = '/dashboard'): string {
  const host = typeof window === 'undefined' ? 'ai-bos.website' : window.location.host;
  const fallback = encodeURIComponent(`https://${host}/download`);
  return `intent://${host}${path}#Intent;scheme=https;package=${ANDROID_APP.package};S.browser_fallback_url=${fallback};end`;
}

/** The iPhone app's bridge (aibos-ios, AppWebView.swift). */
type IOSBridge = { postMessage: (message: Record<string, unknown>) => void };

export function iosBridge(): IOSBridge | null {
  const w = typeof window === 'undefined' ? null
    : (window as Window & { webkit?: { messageHandlers?: { aibos?: IOSBridge } } });
  return w?.webkit?.messageHandlers?.aibos ?? null;
}
