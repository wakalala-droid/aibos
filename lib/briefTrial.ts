'use client';

// The morning brief's free days (UX audit step 4, 17 Nov 2026).
//
// Every new owner is told "record on 3 different days and your morning brief
// unlocks". The brief on Home is Pro+, so on Free and Pro the promise used to
// land on nothing. Now the third recording day opens it on every plan for
// 14 days: the one thing to do each day under the greeting. Then it asks
// once, with what it was doing, whether to keep it on Pro+.
//
// Worked out from the event log alone (no server state): the trial starts on
// the third distinct recording day. A business whose log is past the read
// limit is long past its first week and gets no trial.

import { canAccess, type Tier } from '@/lib/tiers';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { useRecordingDays } from '@/hooks/useRecordingDays';

export const GOAL_DAYS = 3;
export const TRIAL_DAYS = 14;
const DAY = 86_400_000;

export interface BriefTrial {
  /** The plan has the brief: no trial needed. */
  owned: boolean;
  /** Distinct recording days so far (capped meaningfully at the goal). */
  days: number;
  /** In the 14 free days now. */
  active: boolean;
  /** The free days are over (and the plan does not have the brief). */
  ended: boolean;
  /** The last free day (local), when there is a trial. */
  endsOn: Date | null;
}

/** Local midnight of a "YYYY-MM-DD" day. */
function dayStart(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function briefTrialFrom(days: string[], complete: boolean, owned: boolean, now = new Date()): BriefTrial {
  const count = days.length;
  if (owned || !complete || count < GOAL_DAYS) {
    return { owned, days: count, active: false, ended: false, endsOn: null };
  }
  const start = dayStart(days[GOAL_DAYS - 1]);
  const endsOn = new Date(start.getTime() + (TRIAL_DAYS - 1) * DAY);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const active = today.getTime() <= endsOn.getTime();
  return { owned, days: count, active, ended: !active, endsOn };
}

/** An account this new has every recording day in the latest entries. */
const YOUNG_DAYS = 30;

export function useBriefTrial(): BriefTrial | null {
  const tier = useStore((s) => s.tier) as Tier;
  const { profile } = useProfile();
  const rec = useRecordingDays();
  if (!rec) return null;
  // A new owner who brings a big file on day one fills the read limit at once.
  // That said "long past its first week" and the free days never came (audit
  // 19 Nov 2026). An account under a month old is in its first weeks whatever
  // its log holds, and its recording days are the newest entries.
  const created = profile?.created_at ? Date.parse(profile.created_at) : NaN;
  const young = Number.isFinite(created) && Date.now() - created < YOUNG_DAYS * DAY;
  return briefTrialFrom(rec.days, rec.complete || young, canAccess(tier, 'morning_brief'));
}

/** "3 December" */
export function dayWords(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}
