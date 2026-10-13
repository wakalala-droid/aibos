'use client';

// The recorded entries behind Home's activity feed, fetched once and shared by
// every card that needs them. It refetches whenever the books change anywhere
// (the store's booksVersion, lib/booksSignal.ts): keyed on the number of
// entries it missed a fix, which changes an entry and not the count. The money
// line and its figures are read on the server instead (hooks/useMoney).

import { useEffect, useState } from 'react';
import { listEvents, type BusinessEvent } from '@/lib/api';
import { useStore } from '@/lib/store';

let cache: { key: string; at: number; events: BusinessEvent[] } | null = null;
// A read already on its way for these same books is shared, never one for older books.
let inflight: { key: string; req: Promise<BusinessEvent[]> } | null = null;
const FRESH_MS = 30_000;

function load(key: string): Promise<BusinessEvent[]> {
  if (!inflight || inflight.key !== key) {
    const req = listEvents({ limit: 1000 }).then((evs) => evs.filter((e) => e.status !== 'void'));
    inflight = { key, req };
    void req.finally(() => { if (inflight?.req === req) inflight = null; }).catch(() => {});
  }
  return inflight.req;
}

/** Recorded entries, newest first; null while the first load is running. */
export function useBooksEvents(): BusinessEvent[] | null {
  const owner = useStore((s) => s.ownerId) ?? '';
  const version = useStore((s) => s.booksVersion);
  const key = `${owner}|${version}`;
  // Another owner's entries are never shown, even for a moment.
  const [events, setEvents] = useState<BusinessEvent[] | null>(cache && cache.key.startsWith(`${owner}|`) ? cache.events : null);

  useEffect(() => {
    let alive = true;
    if (cache && cache.key === key && Date.now() - cache.at < FRESH_MS) {
      setEvents(cache.events);
      return;
    }
    load(key)
      .then((evs) => {
        cache = { key, at: Date.now(), events: evs };
        if (alive) setEvents(evs);
      })
      .catch(() => { if (alive) setEvents((cur) => cur ?? []); });
    return () => { alive = false; };
  }, [key]);

  return events;
}
