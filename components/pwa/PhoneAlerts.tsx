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
 * Lives in the bell, where the alerts it carries already are.
 */
import { useCallback, useEffect, useState } from 'react';
import { getPushKey, subscribePush, unsubscribePush, sendTestPush } from '@/lib/api';

type State = 'checking' | 'unsupported' | 'needs_install' | 'off' | 'on' | 'blocked' | 'unavailable';

/** base64url (what the server sends) to the bytes the browser wants. */
function keyBytes(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PhoneAlerts() {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

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
      setState((await reg.pushManager.getSubscription()) ? 'on' : 'off');
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
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ flex: '1 1 180px', fontSize: 'var(--fs-label)', lineHeight: 1.5, color: 'var(--text-3)' }}>
        {note || line}
      </span>
      {(state === 'off' || state === 'on') && (
        <button
          type="button"
          onClick={() => void (state === 'on' ? turnOff() : turnOn())}
          disabled={busy}
          style={{
            padding: '8px 14px', minHeight: 40, borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
            border: state === 'on' ? '1px solid var(--border-md)' : 'none',
            background: state === 'on' ? 'transparent' : 'var(--cyan)',
            color: state === 'on' ? 'var(--text-2)' : '#fff',
            fontSize: 'var(--fs-label)', fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'Working…' : state === 'on' ? 'Turn off here' : 'Turn on'}
        </button>
      )}
    </div>
  );
}
