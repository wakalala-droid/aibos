'use client';
/**
 * "Get these on your phone" (upgrade 10).
 *
 * The bell only speaks when the owner opens AIBOS. This asks the browser for
 * permission once and remembers it on the server, so a booking request, a
 * guest's payment or a plan renewal arrives as a notification on the lock
 * screen with AIBOS closed.
 *
 * It says what it needs, in order, instead of failing:
 *   · on an iPhone, notifications only work once AIBOS is on the Home Screen
 *   · a browser that does not do this at all is told so plainly
 *   · a refused permission is the person's choice; it says how to change it
 *
 * Lives in the bell, where the alerts it carries already are. Also on the
 * Schedule page (`embedded`), where an owner sets the reminders it carries.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPushKey, subscribePush, unsubscribePush, sendTestPush } from '@/lib/api';

type State = 'checking' | 'unsupported' | 'needs_install' | 'off' | 'on' | 'blocked' | 'unavailable';

// Once per page load, a device that has notifications on tells the server so
// again: the server names the device from that request ("Chrome on an Android
// phone"), and a copy the server lost comes back instead of silently getting
// nothing.
let reintroduced = false;

/** base64url (what the server sends) to the bytes the browser wants. */
function keyBytes(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PhoneAlerts({ embedded = false, onChange }: {
  /** Inside a page card rather than at the foot of the bell's tray. */
  embedded?: boolean;
  /** Told after this device is turned on or off, so a list can refresh. */
  onChange?: (on: boolean) => void;
} = {}) {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  // Read through a ref so a parent's new callback each render does not re-run the check.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const check = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const installed = window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState(isApple && !installed ? 'needs_install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setState('blocked'); return; }
    try {
      const { configured } = await getPushKey();
      if (!configured) { setState('unavailable'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
      if (sub && !reintroduced) {
        reintroduced = true;
        void subscribePush(sub.toJSON()).then(() => onChangeRef.current?.(true)).catch(() => { /* next load tries again */ });
      }
    } catch {
      setState('unavailable');
    }
  }, []);
  useEffect(() => { void check(); }, [check]);

  const turnOn = async () => {
    setBusy(true); setNote('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'blocked' : 'off'); return; }
      const { key } = await getPushKey();
      if (!key) { setState('unavailable'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key) as unknown as BufferSource,
      });
      await subscribePush(sub.toJSON());
      setState('on');
      onChange?.(true);
      await sendTestPush();
      setNote('Turned on. A test notification is on its way to this device.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not turn notifications on here.');
    } finally { setBusy(false); }
  };

  const turnOff = async () => {
    setBusy(true); setNote('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await unsubscribePush(sub.endpoint); await sub.unsubscribe(); }
      setState('off');
      onChange?.(false);
      setNote('Off on this device. The bell still shows everything.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not turn them off here.');
    } finally { setBusy(false); }
  };

  if (state === 'checking' || state === 'unavailable') return null;

  const line =
    state === 'on' ? 'Alerts also come to this device.'
      : state === 'needs_install' ? 'Add AIBOS to your Home Screen first (Share, then Add to Home Screen), then turn these on.'
        : state === 'unsupported' ? 'This browser cannot show notifications. Try Chrome, Edge or Safari.'
          : state === 'blocked' ? 'Notifications are blocked for AIBOS in this browser. Allow them in the site settings, then come back.'
            : 'Get these on your phone, even with AIBOS closed.';

  return (
    <div style={{
      padding: embedded ? 0 : '12px 16px', borderTop: embedded ? 'none' : '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ flex: '1 1 180px', fontSize: 16, lineHeight: 1.6, color: 'var(--text-3)' }}>
        {note || line}
      </span>
      {(state === 'off' || state === 'on') && (
        <button
          type="button"
          onClick={() => void (state === 'on' ? turnOff() : turnOn())}
          disabled={busy}
          style={{
            padding: '8px 16px', minHeight: 44, borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
            border: state === 'on' ? '1px solid var(--border-md)' : '1px solid var(--text-1)',
            background: state === 'on' ? 'transparent' : 'var(--text-1)',
            color: state === 'on' ? 'var(--text-2)' : 'var(--bg-card)',
            fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'Working…' : state === 'on' ? 'Turn off here' : 'Turn on'}
        </button>
      )}
    </div>
  );
}
