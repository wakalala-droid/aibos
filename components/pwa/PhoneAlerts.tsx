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
 * THE IPHONE APP. Its web view has no web push, so the app does it natively
 * (aibos-ios, Push.swift): the page posts {type:'push-register'} over the
 * `aibos` bridge, iOS asks the owner, and the app answers with the event
 * 'aibos-push-token' carrying this phone's Apple token, which goes to the API
 * (apns.py). iOS keeps the permission itself, so "Turn off here" forgets the
 * phone on the server and remembers that on the phone.
 *
 * Lives in the bell, where the alerts it carries already are. Also on the
 * Schedule page (`embedded`), where an owner sets the reminders it carries.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPushKey, subscribePush, unsubscribePush, sendTestPush, subscribeIosPush, unsubscribeIosPush,
} from '@/lib/api';
import { inApp, iosBridge } from '@/lib/nativeApp';

// 'ios_app': an iPhone app too old to answer the bridge.
type State = 'checking' | 'unsupported' | 'needs_install' | 'ios_app' | 'off' | 'on' | 'blocked' | 'unavailable';

// Once per page load, a device that has notifications on tells the server so
// again: the server names the device from that request ("Chrome on an Android
// phone"), and a copy the server lost comes back instead of silently getting
// nothing.
let reintroduced = false;

/** What the iPhone app answers: 'granted' with this phone's token, 'denied'
 *  (off in Settings), 'not_asked', or 'error'. */
interface IosAnswer { status: 'granted' | 'denied' | 'not_asked' | 'error'; token?: string }

/** localStorage: the owner turned alerts off in this iPhone app. */
const IOS_OFF_KEY = 'aibos-ios-alerts-off';

function iosOff(): boolean {
  try { return window.localStorage.getItem(IOS_OFF_KEY) === '1'; } catch { return false; }
}
function setIosOff(off: boolean) {
  try {
    if (off) window.localStorage.setItem(IOS_OFF_KEY, '1'); else window.localStorage.removeItem(IOS_OFF_KEY);
  } catch { /* storage refused: the server copy still decides */ }
}

/** Ask the iPhone app for this phone's token. `ask` shows iOS's question if it
 *  has never been asked. Null when the app does not answer in time. */
function askIosApp(ask: boolean, waitMs: number): Promise<IosAnswer | null> {
  const bridge = iosBridge();
  if (!bridge) return Promise.resolve(null);
  return new Promise((resolve) => {
    const finish = (answer: IosAnswer | null) => {
      window.removeEventListener('aibos-push-token', heard);
      window.clearTimeout(timer);
      resolve(answer);
    };
    const heard = (e: Event) => finish((e as CustomEvent<IosAnswer>).detail ?? null);
    const timer = window.setTimeout(() => finish(null), waitMs);
    window.addEventListener('aibos-push-token', heard);
    bridge.postMessage({ type: 'push-register', ask });
  });
}

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
    if (inApp() === 'ios') {
      const answer = await askIosApp(false, 5000);
      if (!answer) { setState('ios_app'); return; }
      if (answer.status === 'denied') { setState('blocked'); return; }
      const on = answer.status === 'granted' && Boolean(answer.token) && !iosOff();
      setState(on ? 'on' : 'off');
      if (on && answer.token && !reintroduced) {
        reintroduced = true;
        void subscribeIosPush(answer.token).then(() => onChangeRef.current?.(true)).catch(() => { /* next load tries again */ });
      }
      return;
    }
    const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const installed = window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      // The iPhone app's web view has no web push; Home Screen steps would be wrong there.
      setState(inApp() === 'ios' ? 'ios_app' : isApple && !installed ? 'needs_install' : 'unsupported');
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

  // Back from the iPhone's Settings with alerts allowed: show it straight away.
  useEffect(() => {
    if (state !== 'blocked' || inApp() !== 'ios') return;
    const back = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [state, check]);

  const turnOnIos = async () => {
    // Long enough for the owner to read iOS's question and answer it.
    const answer = await askIosApp(true, 120_000);
    if (!answer) { setNote('The app did not answer. Close AIBOS, open it again and try once more.'); return; }
    if (answer.status === 'denied') { setState('blocked'); return; }
    if (answer.status !== 'granted' || !answer.token) {
      setNote('This iPhone could not sign up for alerts just now. Check your connection and try again.');
      return;
    }
    await subscribeIosPush(answer.token);
    setIosOff(false);
    setState('on');
    onChange?.(true);
    const { apns } = await getPushKey();
    if (!apns) { setNote('Turned on. Alerts will reach this iPhone as soon as AIBOS finishes setting them up.'); return; }
    await sendTestPush();
    setNote('Turned on. A test alert is on its way to this iPhone.');
  };

  const turnOffIos = async () => {
    const answer = await askIosApp(false, 5000);
    if (answer?.token) await unsubscribeIosPush(answer.token);
    setIosOff(true);
    setState('off');
    onChange?.(false);
    setNote('Off on this iPhone. The bell still shows everything.');
  };

  const turnOn = async () => {
    setBusy(true); setNote('');
    try {
      if (inApp() === 'ios') { await turnOnIos(); return; }
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
      if (inApp() === 'ios') { await turnOffIos(); return; }
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
  const iosApp = inApp() === 'ios';

  const line =
    state === 'on' ? 'Alerts also come to this device.'
      : state === 'needs_install' ? 'Add AIBOS to your Home Screen first (Share, then Add to Home Screen), then turn these on.'
        : state === 'ios_app' ? 'Update the AIBOS app to get these on your lock screen. Every alert still shows in the bell.'
        : state === 'unsupported' ? 'This browser cannot show notifications. Try Chrome, Edge or Safari.'
          : state === 'blocked' && iosApp ? 'Alerts are off for AIBOS in your iPhone settings. Turn them on there, then come back.'
          : state === 'blocked' ? 'Notifications are blocked for AIBOS in this browser. Allow them in the site settings, then come back.'
            : iosApp ? 'Get these on your lock screen, even with AIBOS closed.'
            : 'Get these on your phone, even with AIBOS closed.';

  return (
    <div style={{
      padding: embedded ? 0 : '12px 16px', borderTop: embedded ? 'none' : '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ flex: '1 1 180px', fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-3)' }}>
        {note || line}
      </span>
      {state === 'blocked' && iosApp && (
        <button
          type="button"
          onClick={() => iosBridge()?.postMessage({ type: 'push-settings' })}
          style={{
            padding: '8px 16px', minHeight: 44, borderRadius: 10, cursor: 'pointer',
            border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)',
            fontSize: 'var(--fs-body)', fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          Open Settings
        </button>
      )}
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
            fontSize: 'var(--fs-body)', fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'Working…' : state === 'on' ? 'Turn off here' : 'Turn on'}
        </button>
      )}
    </div>
  );
}
