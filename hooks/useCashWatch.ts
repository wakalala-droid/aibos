'use client';

// The 13-week cash watch, read once per change of the books and shared by
// the cards that show it (Home's cash watch and the "Needs you" list), so
// both say the same thing from one answer.

import { useEffect, useState } from 'react';
import { getCashWatch, type CashWatch } from '@/lib/api';
import { useStore } from '@/lib/store';

let cache: { version: number; watch: CashWatch } | null = null;
let inflight: { version: number; req: Promise<CashWatch> } | null = null;

export function useCashWatch(): CashWatch | null {
  const version = useStore((s) => s.booksVersion);
  const [watch, setWatch] = useState<CashWatch | null>(() => (cache && cache.version === version ? cache.watch : null));

  useEffect(() => {
    if (version === 0) return;
    if (cache && cache.version === version) { setWatch(cache.watch); return; }
    let alive = true;
    if (!inflight || inflight.version !== version) {
      const req = getCashWatch();
      inflight = { version, req };
      req.then((w) => { cache = { version, watch: w }; })
        .catch(() => { /* Home stands without it */ })
        .finally(() => { if (inflight?.req === req) inflight = null; });
    }
    inflight.req.then((w) => { if (alive) setWatch(w); }).catch(() => {});
    return () => { alive = false; };
  }, [version]);

  return watch;
}
