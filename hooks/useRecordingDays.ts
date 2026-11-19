'use client';

// The days the owner has recorded on, from the event log, read once per
// change of the books and shared by the first-week card and the morning
// brief's free days (lib/briefTrial.ts). Keyed by owner too, so a shared
// browser never shows one owner another's days.
//
// `complete` is false when the log hit the read limit: then the oldest days
// are not all here, and the business is well past its first week anyway.

import { useEffect, useState } from 'react';
import { listEvents } from '@/lib/api';
import { useStore } from '@/lib/store';

const LIMIT = 500;

export interface RecordingDays {
  /** Distinct local days with a live entry, oldest first ("2026-11-17"). */
  days: string[];
  complete: boolean;
}

let cache: { key: string; value: RecordingDays } | null = null;
let inflight: { key: string; req: Promise<RecordingDays> } | null = null;

async function read(): Promise<RecordingDays> {
  const events = await listEvents({ limit: LIMIT });
  const days = new Set<string>();
  for (const e of events) {
    if (e.status === 'void') continue;
    // The day it was written down, not the day it happened (audit 19 Nov
    // 2026): a file of last year's sales, or three backdated entries made in
    // one sitting, met "record on 3 different days" without a second visit.
    days.add(new Date(e.recorded_at || e.occurred_at).toLocaleDateString('en-CA'));
  }
  return { days: [...days].sort(), complete: events.length < LIMIT };
}

export function useRecordingDays(): RecordingDays | null {
  const version = useStore((s) => s.booksVersion);
  const owner = useStore((s) => s.ownerId) ?? '';
  const key = `${owner}|${version}`;
  const [value, setValue] = useState<RecordingDays | null>(() => (cache && cache.key === key ? cache.value : null));

  useEffect(() => {
    if (cache && cache.key === key) { setValue(cache.value); return; }
    let alive = true;
    if (!inflight || inflight.key !== key) {
      const req = read();
      inflight = { key, req };
      req.then((v) => { cache = { key, value: v }; })
        .catch(() => { /* the cards stay away */ })
        .finally(() => { if (inflight?.req === req) inflight = null; });
    }
    inflight.req.then((v) => { if (alive) setValue(v); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);

  return value;
}
