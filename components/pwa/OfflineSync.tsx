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

import { useEffect, useSyncExternalStore } from 'react';
import { useStore } from '@/lib/store';
import { subscribeOutbox, outboxCount, flushOutbox } from '@/lib/outbox';

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
    return () => { cancelled = true; window.removeEventListener('online', onOnline); };
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
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 'var(--fs-label)', fontWeight: 600,
        color: 'var(--amber)', background: 'rgba(251,191,36,0.12)',
        border: '1px solid rgba(251,191,36,0.3)', padding: '4px 10px', borderRadius: 999,
        ...style,
      }}
    >
      {count} saved offline — will sync when signal returns
    </span>
  );
}
