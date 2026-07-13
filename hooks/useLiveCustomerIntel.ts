'use client';

// Fetch-once bridge from the live event spine to the Engine-2 store slices
// (audit #5). On success the shared store is hydrated — Customer Intel, Churn
// and Product Matrix all read the same slices, so one fetch feeds them all.
// Returns the `insufficient` payload when the honest thresholds aren't met so
// the page can show progress instead of a dead end. Silent on 402 (Free) and
// network failure — the upload-based view still stands.

import { useEffect, useState } from 'react';
import { getCustomerIntelligence, type LiveCustomerIntel } from '@/lib/api';
import { useStore } from '@/lib/store';

export function useLiveCustomerIntel(): LiveCustomerIntel | null {
  const hydrate = useStore((s) => s.hydrateLiveCustomerIntel);
  const [insufficient, setInsufficient] = useState<LiveCustomerIntel | null>(null);

  useEffect(() => {
    let alive = true;
    getCustomerIntelligence()
      .then((d) => {
        if (!alive) return;
        if (d.insufficient) setInsufficient(d);
        else hydrate(d as unknown as Record<string, unknown>);
      })
      .catch(() => { /* Free tier (402) or offline — upload view stands */ });
    return () => { alive = false; };
  }, [hydrate]);

  return insufficient;
}
