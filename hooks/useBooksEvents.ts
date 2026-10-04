'use client';

// The recorded entries behind Home and Money, fetched once and shared by every
// card that needs them (the balance line, the activity feed, today's sales).
// It refetches when the books change: the twin's entry count moves after any
// record, fix or removal, so a sale recorded in the Record sheet lands on the
// screen behind it without a reload.

import { useEffect, useState } from 'react';
import { listEvents, type BusinessEvent } from '@/lib/api';
import { useStore } from '@/lib/store';

let cache: { count: number; at: number; events: BusinessEvent[] } | null = null;
let inflight: Promise<BusinessEvent[]> | null = null;
const FRESH_MS = 30_000;

function load(): Promise<BusinessEvent[]> {
  if (!inflight) {
    inflight = listEvents({ limit: 1000 })
      .then((evs) => evs.filter((e) => e.status !== 'void'))
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Recorded entries, newest first; null while the first load is running. */
export function useBooksEvents(): BusinessEvent[] | null {
  const count = useStore((s) => Number(s.twin?.event_count) || 0);
  const [events, setEvents] = useState<BusinessEvent[] | null>(cache?.events ?? null);

  useEffect(() => {
    let alive = true;
    if (cache && cache.count === count && Date.now() - cache.at < FRESH_MS) {
      setEvents(cache.events);
      return;
    }
    load()
      .then((evs) => {
        cache = { count, at: Date.now(), events: evs };
        if (alive) setEvents(evs);
      })
      .catch(() => { if (alive) setEvents((cur) => cur ?? []); });
    return () => { alive = false; };
  }, [count]);

  return events;
}
