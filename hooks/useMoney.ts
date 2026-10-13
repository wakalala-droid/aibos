'use client';

// The money right now and everything said about it, from ONE read of the
// confirmed entries (GET /books/money): the figure, where it sits, the line
// under it, money in and out each month, how long it lasts and what is still
// waiting for the owner. Every card on Home and Money reads it here, so they
// cannot disagree with each other, and reads it again whenever the books
// change anywhere (the store's booksVersion, lib/booksSignal.ts).
//
// The line used to be drawn in the browser from the newest 1,000 entries,
// counting entries nobody had confirmed; "Where it is" refetched only when the
// number of entries changed, so putting one right changed nothing on screen.

import { useEffect, useState } from 'react';
import { getMoney, type MoneyView } from '@/lib/api';
import { useStore } from '@/lib/store';

const cache = new Map<string, MoneyView>();
const inflight = new Map<string, Promise<MoneyView>>();

function remember(key: string, view: MoneyView) {
  cache.set(key, view);
  while (cache.size > 8) cache.delete(cache.keys().next().value as string);
}

/** null until the first read. Keeps showing the last figures while a new read runs. */
export function useMoney(days = 30): MoneyView | null {
  // The owner is in the key: a shared browser never shows one person's money to another.
  const owner = useStore((s) => s.ownerId) ?? '';
  const version = useStore((s) => s.booksVersion);
  const key = `${owner}|${version}|${days}`;
  const [view, setView] = useState<MoneyView | null>(() => cache.get(key) ?? null);

  useEffect(() => {
    // Version 0 is before the books were first counted on this visit: the
    // count is already on its way and moves the version, so one read is enough.
    if (version === 0) return;
    let alive = true;
    const hit = cache.get(key);
    if (hit) { setView(hit); return; }
    let req = inflight.get(key);
    if (!req) {
      req = getMoney(days).finally(() => inflight.delete(key));
      inflight.set(key, req);
    }
    req.then((v) => { remember(key, v); if (alive) setView(v); })
      .catch(() => { /* the cards keep what they last showed */ });
    return () => { alive = false; };
  }, [key, days, version]);

  return view;
}
