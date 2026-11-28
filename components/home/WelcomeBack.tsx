'use client';

// Welcome back (habit audit, 19 Nov 2026).
//
// An owner who stopped for a few days came back to the same Home as ever,
// with the gap in the books unsaid. A gap is where the habit ends: catching
// up feels like a chore, so it waits, so the numbers drift, so AI-BOS stops
// being opened. After three days without an entry, Home's one nudge says
// welcome back and offers the two honest ways on: catch up the days missed
// (the Record sheet takes a date), or start fresh from today. No count of
// days lost and no warning colour: a fresh start, not a telling off.
//
// Counted (20 Nov 2026) in the usage log AI-BOS already keeps, as
// 'welcome_back' with meta.choice: 'shown' once per time away on a device,
// then 'catch_up' or 'fresh_start' on a tap, each with days_away. Shown
// against tapped says whether the card brings owners back; the two taps say
// which way back they choose.

import { useEffect, useState } from 'react';
import { Sunrise } from 'lucide-react';
import { useProfile } from '@/lib/profile';
import { roleAllows } from '@/lib/nav';
import { openRecordSheet } from '@/lib/recordSheet';
import { useRecordingDays } from '@/hooks/useRecordingDays';
import { GOAL_DAYS, dayWords } from '@/lib/briefTrial';
import { logUsage } from '@/lib/usage';

/** Days without an entry before Home says welcome back. */
export const AWAY_DAYS = 3;
/** The last recording day the owner chose to start fresh from. */
const FRESH_KEY = 'aibos-fresh-start-v1';
/** The last recording day the card was counted as shown for, on this device. */
const SEEN_KEY = 'aibos-welcome-back-seen-v1';

/** Whole local days since the last recording day ("2026-11-14"). */
export function daysSince(last: string, now: Date = new Date()): number {
  const [y, m, d] = last.split('-').map(Number);
  const then = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - then.getTime()) / 86_400_000);
}

export default function WelcomeBack() {
  const rec = useRecordingDays();
  const { teamRole } = useProfile();
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    try { setFresh(window.localStorage.getItem(FRESH_KEY)); } catch { /* private mode */ }
  }, []);

  // A new owner who drifts sees the first-week card instead.
  const last = rec && rec.days.length >= GOAL_DAYS ? rec.days[rec.days.length - 1] : null;
  const show = !!last && roleAllows(teamRole, '/dashboard/record') && daysSince(last) >= AWAY_DAYS && fresh !== last;

  useEffect(() => {
    if (!show || !last) return;
    try {
      if (window.localStorage.getItem(SEEN_KEY) === last) return;
      window.localStorage.setItem(SEEN_KEY, last);
    } catch { /* private mode: counted on each visit */ }
    logUsage('welcome_back', { meta: { choice: 'shown', days_away: daysSince(last) } });
  }, [show, last]);

  if (!show || !last) return null;

  const [y, m, d] = last.split('-').map(Number);
  const since = dayWords(new Date(y, m - 1, d));
  const away = daysSince(last);
  const catchUp = () => {
    logUsage('welcome_back', { meta: { choice: 'catch_up', days_away: away } });
    openRecordSheet();
  };
  const startFresh = () => {
    logUsage('welcome_back', { meta: { choice: 'fresh_start', days_away: away } });
    try { window.localStorage.setItem(FRESH_KEY, last); } catch { /* private mode */ }
    setFresh(last);
  };

  return (
    <div role="status" className="bento nudge-promo" style={{ marginBottom: 16 }}>
      <div className="bento-head">
        <span className="bento-icon" aria-hidden="true"><Sunrise /></span>
        <div className="bento-main">
          <div className="bento-titlerow">
            <p className="bento-title">Welcome back</p>
            <span className="bento-tag">Last entry {since}</span>
          </div>
          <p className="bento-text">
            Add what you sold and spent since {since}, each on its own day. A few minutes and your numbers are right again.
          </p>
        </div>
      </div>
      <div className="bento-foot">
        <button type="button" className="pill pill-primary" onClick={catchUp}>Catch up</button>
        <button type="button" className="pill pill-quiet" onClick={startFresh}>Start from today</button>
      </div>
    </div>
  );
}
