'use client';

// ActivationProgress: turns the retention hook into the activation goal
// (audit §10 fix #4): "record on 3 different days and your morning brief
// unlocks." Counts DISTINCT recording days from the event log, celebrates the
// unlock, then disappears. Silent once the goal is met and acknowledged, so it
// never nags an established user.
//
// The promise is kept on every plan (UX audit step 4, 17 Nov 2026): on Free
// and Pro the third day opens the brief on Home for 14 days (lib/briefTrial),
// where before "See it" opened a reports page and the brief never came.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { useProfile } from '@/lib/profile';
import { openRecordSheet } from '@/lib/recordSheet';
import { useBriefTrial, GOAL_DAYS, TRIAL_DAYS, dayWords } from '@/lib/briefTrial';

const DISMISS_KEY = 'aibos-activation-done-v1';

export default function ActivationProgress() {
  const trial = useBriefTrial();
  const { teamRole } = useProfile();
  const [done, setDone] = useState(false);

  useEffect(() => {
    try { setDone(window.localStorage.getItem(DISMISS_KEY) === '1'); } catch { /* private mode */ }
  }, []);

  // Not loaded yet, or the owner has already blown past the goal and it's been
  // acknowledged → stay out of the way.
  if (trial === null || done) return null;
  // The owner's goal: staff and accountants do not run the brief.
  if (teamRole && teamRole !== 'owner') return null;
  const days = trial.days;
  // A clearly-established business (well past the goal) never sees this.
  if (days > GOAL_DAYS + 2) return null;

  const reached = days >= GOAL_DAYS;
  // The free days are over: BriefTrialEnded says so, this must not say "on".
  if (reached && trial.ended) return null;
  const pct = Math.min(days / GOAL_DAYS, 1) * 100;
  const dismiss = () => { try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ } setDone(true); };

  const text = !reached
    ? `Record a sale or expense on ${GOAL_DAYS} different days. That is enough for AI-BOS to spot your first patterns.`
    : trial.owned
      ? 'Every morning at 06:30 AI-BOS sums up your day, and the one thing to do sits under your greeting.'
      : trial.active && trial.endsOn
        ? `For the next ${TRIAL_DAYS} days, free until ${dayWords(trial.endsOn)}: the one thing to do each day sits under your greeting.`
        : 'The one thing to do each day sits under your greeting.';

  // A bento card (5 Oct 2026): round mark, spaced-capital title with the day
  // count as its tag, one even bar and one next step.
  return (
    <div role="status" className="bento nudge-promo" style={{ marginBottom: 16 }}>
      <div className="bento-head">
        <span className="bento-icon" aria-hidden="true"><CalendarCheck /></span>
        <div className="bento-main">
          <div className="bento-titlerow">
            <p className="bento-title">{reached ? 'Your morning brief is on' : 'Unlock your morning brief'}</p>
            <span className="bento-tag">{Math.min(days, GOAL_DAYS)} of {GOAL_DAYS} days</span>
          </div>
          <div className="progress-track" style={{ height: 8, marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="bento-text">{text}</p>
        </div>
      </div>
      <div className="bento-foot">
        {reached ? (
          <button type="button" className="pill pill-primary" onClick={dismiss}>Got it</button>
        ) : (
          <>
            <button type="button" className="pill pill-primary" onClick={openRecordSheet}>Record now</button>
            {days === 0 && <Link href="/dashboard/demo" className="pill pill-quiet">See a sample first</Link>}
          </>
        )}
      </div>
    </div>
  );
}
