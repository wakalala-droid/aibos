'use client';

// The brief's inputs (products, today's and yesterday's sales, expected
// deliveries, today's commitments, overdue invoices), fetched once and shared
// by every Home card that needs them. Refetched when the books change, like
// useBooksEvents.

import { useEffect, useState } from 'react';
import { fetchBriefExtras, type BriefExtras } from '@/lib/briefData';
import { useStore } from '@/lib/store';

let cache: { count: number; at: number; extras: BriefExtras } | null = null;
let inflight: Promise<BriefExtras> | null = null;
const FRESH_MS = 30_000;

/** null while the first load is running. */
export function useBriefExtras(): BriefExtras | null {
  const count = useStore((s) => Number(s.twin?.event_count) || 0);
  const [extras, setExtras] = useState<BriefExtras | null>(cache?.extras ?? null);

  useEffect(() => {
    let alive = true;
    if (cache && cache.count === count && Date.now() - cache.at < FRESH_MS) {
      setExtras(cache.extras);
      return;
    }
    if (!inflight) inflight = fetchBriefExtras().finally(() => { inflight = null; });
    inflight
      .then((x) => {
        cache = { count, at: Date.now(), extras: x };
        if (alive) setExtras(x);
      })
      .catch(() => { /* the cards show their empty states */ });
    return () => { alive = false; };
  }, [count]);

  return extras;
}
