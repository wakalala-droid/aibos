'use client';

/**
 * InstallPrompt — asks the owner to put AIBOS on their home screen or desktop.
 *
 * The app has been installable for a while (manifest, icons, a service worker
 * with an offline page) and almost nobody knew: Chrome's own hint is a small
 * icon in the address bar, Safari has none at all, and an owner who opens
 * AIBOS from a WhatsApp link or a bookmark each morning never finds either.
 * An icon next to their other apps is how a tool becomes a habit.
 *
 * What it offers depends on what the browser can do:
 *   • Chrome, Edge, Samsung Internet (phone or computer): one button that opens
 *     the browser's own install dialog.
 *   • iPhone and iPad: the two taps, because Apple gives a web page no button.
 *   • Safari on a Mac: File, then Add to Dock.
 *   • Anything else, or already installed: nothing.
 *
 * It waits its turn: never over the first-run tours, never inside the
 * installed app, and "Not now" keeps it away for two weeks.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const DISMISSED_KEY = 'aibos-install-dismissed-at';
const INSTALLED_KEY = 'aibos-installed';
const TOUR_DONE_KEY = 'aibos-tour-done-v1';     // components/onboarding/DashboardTour.tsx
const QUIET_DAYS = 14;
const DAY = 86_400_000;

/** The event Chromium browsers fire when the app can be installed. */
export interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window { __aibosInstall?: InstallEvent | null }
}

export const INSTALL_READY_EVENT = 'aibos-install-ready';

/** Keep the browser's install offer for when the owner is ready for it. Called
 *  once from the root layout, because the browser fires it on whatever page
 *  loads first, often the login screen, before any dashboard has mounted. */
export function captureInstallPrompt(): () => void {
  const onPrompt = (e: Event) => {
    e.preventDefault();
    window.__aibosInstall = e as InstallEvent;
    window.dispatchEvent(new Event(INSTALL_READY_EVENT));
  };
  const onInstalled = () => {
    window.__aibosInstall = null;
    try { window.localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* private mode */ }
    window.dispatchEvent(new Event(INSTALL_READY_EVENT));
  };
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
  };
}

type Mode = 'native' | 'ios' | 'mac-safari' | null;

function read(key: string): string {
  try { return window.localStorage.getItem(key) ?? ''; } catch { return ''; }
}

function standalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detect(): Mode {
  if (window.__aibosInstall) return 'native';
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch screen gives it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  const macSafari = /Macintosh/.test(ua) && /Version\/(\d+)/.test(ua) && /Safari/.test(ua)
    && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua) && Number(ua.match(/Version\/(\d+)/)?.[1] ?? 0) >= 17;
  return macSafari ? 'mac-safari' : null;
}

export default function InstallPrompt() {
  const pathname = usePathname() || '';
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const phone = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent);

  useEffect(() => {
    let timer = 0;
    const decide = () => {
      if (standalone() || read(INSTALLED_KEY) === '1') { setMode(null); return; }
      const dismissed = Number(read(DISMISSED_KEY) || 0);
      if (dismissed && Date.now() - dismissed < QUIET_DAYS * DAY) { setMode(null); return; }
      // The first-run tours come first: they point at things on the page.
      if (pathname === '/dashboard' && read(TOUR_DONE_KEY) !== '1') { setMode(null); return; }
      if (document.body.dataset.welcomeTour === 'open') { setMode(null); return; }
      setMode(detect());
    };
    // A moment after the page settles, so it never jumps in while the owner
    // is reaching for the first thing they came to do.
    timer = window.setTimeout(decide, 2500);
    window.addEventListener(INSTALL_READY_EVENT, decide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(INSTALL_READY_EVENT, decide);
    };
  }, [pathname]);

  if (!mode) return null;

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* private mode */ }
    setMode(null);
  };

  const install = async () => {
    const offer = window.__aibosInstall;
    if (!offer) { setMode(detect()); return; }
    setBusy(true);
    try {
      await offer.prompt();
      const { outcome } = await offer.userChoice;
      // The browser allows one prompt per offer; a new one arrives if it can be asked again.
      window.__aibosInstall = null;
      if (outcome === 'accepted') {
        try { window.localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* private mode */ }
        setMode(null);
      } else {
        dismiss();
      }
    } catch {
      setMode(null);
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'native' && !phone
    ? 'Install AIBOS on this computer'
    : mode === 'mac-safari' ? 'Add AIBOS to your Dock' : 'Put AIBOS on your home screen';

  return (
    <section
      aria-label="Install AIBOS as an app"
      style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '14px 16px', margin: '0 0 16px', borderRadius: 12,
        border: '1px solid color-mix(in srgb, var(--cyan) 40%, transparent)',
        background: 'color-mix(in srgb, var(--cyan) 9%, transparent)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 48px app icon, nothing to optimise */}
      <img src="/icons/icon-192.png" alt="" width={48} height={48} style={{ borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5, fontWeight: 700, color: 'var(--text-1)' }}>{title}</p>
        {mode === 'native' && (
          <p style={{ margin: '4px 0 0', fontSize: 16, lineHeight: 1.6, color: 'var(--text-2)' }}>
            Open it with one tap, like any other app. It opens straight to your business, full screen and without the browser around it.
          </p>
        )}
        {mode === 'ios' && (
          <ol style={{ margin: '6px 0 0', paddingLeft: 22, fontSize: 16, lineHeight: 1.7, color: 'var(--text-2)' }}>
            <li>
              Tap the Share button <ShareIcon /> {/iPad/.test(navigator.userAgent) ? 'at the top of the screen' : 'at the bottom of the screen'}.
            </li>
            <li>Scroll down and tap <strong style={{ color: 'var(--text-1)' }}>Add to Home Screen</strong>, then <strong style={{ color: 'var(--text-1)' }}>Add</strong>.</li>
          </ol>
        )}
        {mode === 'mac-safari' && (
          <p style={{ margin: '4px 0 0', fontSize: 16, lineHeight: 1.6, color: 'var(--text-2)' }}>
            In the menu bar choose <strong style={{ color: 'var(--text-1)' }}>File</strong>, then <strong style={{ color: 'var(--text-1)' }}>Add to Dock</strong>. AIBOS then opens from your Dock like any other app.
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {mode === 'native' && (
          <button
            type="button"
            onClick={() => void install()}
            disabled={busy}
            style={{
              minHeight: 44, padding: '10px 18px', borderRadius: 8, border: 'none',
              background: 'var(--cyan)', color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            {phone ? 'Add to home screen' : 'Install app'}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          style={{
            minHeight: 44, padding: '10px 16px', borderRadius: 8,
            border: '1px solid var(--border-md)', background: 'transparent',
            color: 'var(--text-2)', fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {mode === 'native' ? 'Not now' : 'Got it'}
        </button>
      </div>
    </section>
  );
}

/** Apple's share glyph, inline so the instruction shows the thing to look for. */
function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" role="img" aria-label="Share"
      style={{ verticalAlign: '-3px', color: 'var(--cyan)' }}>
      <path d="M12 3v12M12 3l-4 4M12 3l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10H6a1 1 0 00-1 1v9a1 1 0 001 1h12a1 1 0 001-1v-9a1 1 0 00-1-1h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
