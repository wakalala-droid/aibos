'use client';

// The 13-week cash watch, read once per change of the books and shared by
// the cards that show it (Home's cash watch and the "Needs you" list), so
// both say the same thing from one answer. Keyed by owner too, so a shared
// browser never shows one owner another's watch.

import { useEffect, useState } from 'react';
import { getCashWatch, type CashWatch } from '@/lib/api';
import { useStore } from '@/lib/store';

let cache: { key: string; watch: CashWatch } | null = null;
let inflight: { key: string; req: Promise<CashWatch> } | null = null;

export function useCashWatch(): CashWatch | null {
  const version = useStore((s) => s.booksVersion);
  const owner = useStore((s) => s.ownerId) ?? '';
  const key = `${owner}|${version}`;
  const [watch, setWatch] = useState<CashWatch | null>(() => (cache && cache.key === key ? cache.watch : null));

  useEffect(() => {
    if (version === 0) return;
    if (cache && cache.key === key) { setWatch(cache.watch); return; }
    let alive = true;
    if (!inflight || inflight.key !== key) {
      const req = getCashWatch();
      inflight = { key, req };
      req.then((w) => { cache = { key, watch: w }; })
        .catch(() => { /* Home stands without it */ })
        .finally(() => { if (inflight?.req === req) inflight = null; });
    }
    inflight.req.then((w) => { if (alive) setWatch(w); }).catch(() => {});
    return () => { alive = false; };
  }, [key, version]);

  return watch;
}
