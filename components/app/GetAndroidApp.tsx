'use client';

/**
 * "Get the app": downloads the AIBOS Android app straight from this website,
 * then shows what to tap next (owner, 21 Oct 2026: "make sure every user
 * installs the APK from the website").
 *
 * Only an Android phone in a browser sees it: the class .when-android hides it
 * everywhere else, before the first paint (lib/nativeApp.ts, APP_BOOT_SCRIPT).
 * It is a plain link to the file, so the download starts even before the page's
 * scripts have loaded; the sheet with the next steps follows once they have.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Notice } from '@/components/kit';
import AndroidSteps from './AndroidSteps';
import { ANDROID_APP } from '@/lib/nativeApp';

export const APK_DOWNLOADED_KEY = 'aibos-apk-downloaded-at';

export function noteApkDownload() {
  try { window.localStorage.setItem(APK_DOWNLOADED_KEY, String(Date.now())); } catch { /* private mode */ }
}

/** The link that downloads the app. Tells `onDownload` once the download starts. */
export function ApkLink({ className = 'pill pill-primary', style, children, onDownload, linkRef }: {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onDownload?: () => void;
  linkRef?: React.Ref<HTMLAnchorElement>;
}) {
  return (
    <a
      ref={linkRef}
      href={ANDROID_APP.apk}
      download="AIBOS.apk"
      type="application/vnd.android.package-archive"
      className={className}
      style={style}
      onClick={() => { noteApkDownload(); onDownload?.(); }}
    >
      {children ?? 'Get the app'}
    </a>
  );
}

/** The button and, after it is tapped, the steps floating at the foot of the screen. */
export default function GetAndroidApp({ className = 'pill pill-primary', style, children }: {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <ApkLink className={`${className} when-android`} style={style} onDownload={() => setOpen(true)}>
        {children}
      </ApkLink>
      {open && mounted && createPortal(
        <div className="app-sheet">
          <Notice
            brand art floating
            role="dialog"
            ariaLabel="Install the AIBOS app"
            title="Now install AIBOS"
            tag="Android"
            onClose={() => setOpen(false)}
            closeLabel="Close the install steps"
            actions={
              <>
                <button type="button" className="pill pill-primary" onClick={() => setOpen(false)}>Done</button>
                <ApkLink className="pill pill-quiet">Download again</ApkLink>
              </>
            }
          >
            <AndroidSteps downloaded />
          </Notice>
        </div>,
        // Inside the navy root on the website and the sign-in page, so the sheet is navy there too.
        document.querySelector('[data-navy]') ?? document.body,
      )}
    </>
  );
}
