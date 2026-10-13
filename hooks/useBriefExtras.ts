'use client';

// The brief's inputs (products, today's and yesterday's sales, expected
// deliveries, today's commitments, overdue invoices), fetched once and shared
// by every Home card that needs them. Refetched whenever the books change
// anywhere (booksVersion), like useBooksEvents.

import { useEffect, useState } from 'react';
import { fetchBriefExtras, type BriefExtras } from '@/lib/briefData';
import { useStore } from '@/lib/store';

let cache: { key: string; at: number; extras: BriefExtras } | null = null;
// A read already on its way for these same books is shared, never one for older books.
let inflight: { key: string; req: Promise<BriefExtras> } | null = null;
const FRESH_MS = 30_000;

/** null while the first load is running. */
export function useBriefExtras(): BriefExtras | null {
  // Read again whenever the books change anywhere (booksVersion), and never
  // another owner's (a shared browser).
  const owner = useStore((s) => s.ownerId) ?? '';
  const version = useStore((s) => s.booksVersion);
  const key = `${owner}|${version}`;
  const [extras, setExtras] = useState<BriefExtras | null>(cache && cache.key.startsWith(`${owner}|`) ? cache.extras : null);

  useEffect(() => {
    let alive = true;
    if (cache && cache.key === key && Date.now() - cache.at < FRESH_MS) {
      setExtras(cache.extras);
      return;
    }
    if (!inflight || inflight.key !== key) {
      const req = fetchBriefExtras();
      inflight = { key, req };
      void req.finally(() => { if (inflight?.req === req) inflight = null; }).catch(() => {});
    }
    inflight.req
      .then((x) => {
        cache = { key, at: Date.now(), extras: x };
        if (alive) setExtras(x);
      })
      .catch(() => { /* the cards show their empty states */ });
    return () => { alive = false; };
  }, [key]);

  return extras;
}
