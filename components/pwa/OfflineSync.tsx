'use client';

// Offline-first plumbing (Business Proposal risk mitigation: connectivity).
//
// <OfflineSync /> — mounted once in the root layout. Registers the service
// worker (production only; dev assets must never be cached) and flushes the
// offline outbox on load and whenever connectivity returns, refreshing the
// twin after a successful sync so every surface catches up. Renders nothing.
//
// <OutboxChip /> — a quiet amber pill any surface can drop in: "N saved
// offline — will sync when signal returns". Disappears at zero. aria-live so
// screen readers hear the state change (accessibility_system.md).

import { CloudOff } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { useStore } from '@/lib/store';
import { subscribeOutbox, outboxCount, flushOutbox } from '@/lib/outbox';
import { listenForNotifications } from '@/lib/sound';
import { captureInstallPrompt } from './InstallPrompt';

export function OfflineSync() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* SW is progressive enhancement */ });
    }
    let cancelled = false;
    const flush = async () => {
      try {
        const res = await flushOutbox();
        if (!cancelled && res.posted > 0) {
          await useStore.getState().refreshTwin();
        }
      } catch { /* next 'online' event retries */ }
    };
    void flush();
    const onOnline = () => { void flush(); };
    window.addEventListener('online', onOnline);
    // The browser offers installation on whichever page loads first; keep the
    // offer until the dashboard asks (components/pwa/InstallPrompt.tsx).
    const releaseInstall = captureInstallPrompt();
    // A notification that lands while AIBOS is open plays the owner's own tone
    // (lib/sound.ts), on the installed app as well as in a tab.
    const stopSound = listenForNotifications();
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      releaseInstall();
      stopSound();
    };
  }, []);
  return null;
}

export function OutboxChip({ style }: { style?: React.CSSProperties }) {
  const count = useSyncExternalStore(subscribeOutbox, outboxCount, () => 0);
  if (count === 0) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      // A pill in the splash's pieces (5 Oct 2026): a round icon, ink words.
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-1)',
        background: 'var(--pill-bg)', border: '1px solid var(--border-md)',
        padding: '4px 14px 4px 4px', borderRadius: 999,
        ...style,
      }}
    >
      <span aria-hidden="true" className="bento-icon" style={{ width: 32, height: 32 }}>
        <CloudOff style={{ width: 16, height: 16 }} />
      </span>
      {count} saved offline. They sync when the signal is back.
    </span>
  );
}
