/**
 * How to put the AIBOS Android app on a phone, in the words the phone itself
 * uses (Chrome's "Download anyway", Android's "Allow from this source", Play
 * Protect's "Install anyway"), so nobody stops at a warning. The last step
 * removes the browser shortcut the app replaces (owner, 21 Oct 2026).
 *
 * Shared by the website's download sheet, the /download page, the dashboard
 * notice and the old shortcut's own screen (components/app/).
 */

import { ANDROID_APP } from '@/lib/nativeApp';

export default function AndroidSteps({ downloaded = false, shortcut = 'maybe' }: {
  /** The download has started: the first step shows its tick. */
  downloaded?: boolean;
  /** 'here': this window is the old shortcut. 'maybe': there may be one. 'none': leave the step out. */
  shortcut?: 'here' | 'maybe' | 'none';
}) {
  return (
    <ol className="app-steps">
      <li className={downloaded ? 'is-done' : undefined}>
        <span className="step-title">Download AIBOS.apk ({ANDROID_APP.size})</span>
        <span className="step-text">
          If Chrome asks, tap <strong>Download anyway</strong>. It asks about every app that does not come from Play, and this one is ours.
        </span>
      </li>
      <li>
        <span className="step-title">Install it</span>
        <span className="step-text">
          Open <strong>AIBOS.apk</strong> from the notification or your Downloads, then tap <strong>Install</strong>.
          If the phone asks first, tap <strong>Settings</strong>, turn on <strong>Allow from this source</strong> and come back.
          If Play Protect asks, tap <strong>More details</strong>, then <strong>Install anyway</strong>.
        </span>
      </li>
      <li>
        <span className="step-title">Open AIBOS</span>
        <span className="step-text">It opens on your business, full screen. If it asks, sign in with Google once.</span>
      </li>
      {shortcut !== 'none' && (
        <li>
          <span className="step-title">Remove the old shortcut</span>
          <span className="step-text">
            {shortcut === 'here'
              ? <>Press and hold the AIBOS icon you opened this from, then tap <strong>Uninstall</strong> or <strong>Remove</strong>.</>
              : <>If you added AIBOS to your home screen from the browser before, press and hold that old icon, then tap <strong>Uninstall</strong> or <strong>Remove</strong>.</>}
            {' '}Your account and your books stay exactly as they are.
          </span>
        </li>
      )}
    </ol>
  );
}
