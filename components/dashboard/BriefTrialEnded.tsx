'use client';

// The morning brief's free days are over (lib/briefTrial.ts): ask once, with
// what it did, whether to keep it on the plan that has it. Shown for ten days
// after the trial, until the owner answers. The iPhone app sells nothing
// (lib/iosApp.ts), so there it only says which plan has it.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sunrise } from 'lucide-react';
import { useProfile } from '@/lib/profile';
import { requiredTier, TIERS } from '@/lib/tiers';
import { NOT_ON_PLAN_SHORT, useIosApp } from '@/lib/iosApp';
import { useBriefTrial } from '@/lib/briefTrial';

const DISMISS_KEY = 'aibos-brief-trial-ended-v1';
const SHOW_DAYS = 10;

export default function BriefTrialEnded() {
  const trial = useBriefTrial();
  const { teamRole } = useProfile();
  const ios = useIosApp();
  const [gone, setGone] = useState(true);
  useEffect(() => {
    try { setGone(window.localStorage.getItem(DISMISS_KEY) === '1'); } catch { setGone(false); }
  }, []);

  if (gone || !trial?.ended || !trial.endsOn) return null;
  if (teamRole && teamRole !== 'owner') return null;
  if (Date.now() - trial.endsOn.getTime() > SHOW_DAYS * 86_400_000) return null;

  const plan = requiredTier('morning_brief');
  const dismiss = () => { try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ } setGone(true); };

  return (
    <div role="status" className="bento nudge-promo" style={{ marginBottom: 16 }}>
      <div className="bento-head">
        <span className="bento-icon" aria-hidden="true"><Sunrise /></span>
        <div className="bento-main">
          <div className="bento-titlerow">
            <p className="bento-title">Your free morning brief has ended</p>
            <span className="bento-tag">{TIERS[plan].name}</span>
          </div>
          <p className="bento-text">
            {ios
              ? `${NOT_ON_PLAN_SHORT}. The one thing to do each day, and the 06:30 brief on your phone, come with ${TIERS[plan].name}.`
              : `Keep the one thing to do each day under your greeting, and get the whole brief on your phone at 06:30, with ${TIERS[plan].name}.`}
          </p>
        </div>
      </div>
      <div className="bento-foot">
        {!ios && <Link href={`/checkout?plan=${plan}`} className="pill pill-primary">Keep it with {TIERS[plan].name}</Link>}
        <button type="button" className="pill pill-quiet" onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}
