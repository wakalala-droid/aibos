'use client';

// BriefSubscribe — the dashboard's switch for the Morning Brief by email.
//
// This card used to take any address and a daily or weekly choice, write them
// to the usage log and say "You're subscribed". Nothing reads that log. The
// brief is sent by aibos-api dispatch_briefs, daily at 06:30, to accounts with
// profiles.brief_email_enabled on a plan that includes it, at the business
// contact email (else the account email). So every owner who subscribed here
// was told a brief was coming that never could.
//
// Now it flips that same setting, says exactly where the brief goes, and is
// honest when the plan or the server's email key is what stands in the way.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sunrise } from 'lucide-react';
import BentoCard from '@/components/ui/BentoCard';
import { useProfile } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { briefDeliveryConfig } from '@/lib/api';
import { canAccess, requiredTier, TIERS, type Tier } from '@/lib/tiers';

type Status = 'idle' | 'saving' | 'error';

export default function BriefSubscribe() {
  const { profile, loading, refresh, ownPlan } = useProfile();
  const tier = useStore((s) => s.tier) as Tier;
  const [status, setStatus] = useState<Status>('idle');
  const [emailLive, setEmailLive] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    briefDeliveryConfig().then((c) => { if (alive) setEmailLive(c.email); });
    return () => { alive = false; };
  }, []);

  if (loading || !profile) return null;

  const allowed = canAccess(tier, 'scheduled_brief');
  const on = Boolean(profile.brief_email_enabled);
  const to = (profile.contact_email || profile.email || '').trim();
  const needed = TIERS[requiredTier('scheduled_brief')].name;

  const setOn = async (next: boolean) => {
    setStatus('saving');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_email_enabled: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await refresh();
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  const saving = status === 'saving';
  const where = to || 'your account email';

  // A bento card like the rest of Home (second bento pass, 5 Oct 2026).
  return (
    <BentoCard icon={<Sunrise />} title="Morning brief" tag={!allowed ? needed : on ? 'On' : 'Off'}
      text={!allowed ? (
        <>Every morning at 06:30: cash, yesterday&apos;s sales, stock to reorder and the one thing to do today,
          by email and as a notification on any phone or computer where you turned them on.
          {ownPlan ? ` It comes with ${needed}.` : ' It comes with a paid plan, which the business owner manages.'}</>
      ) : on ? (
        <span role="status"><strong style={{ color: 'var(--text-1)' }}>On.</strong> Your brief goes to {where} every morning at 06:30
          and to every phone or computer where you turned notifications on.</span>
      ) : (
        <>Every morning at 06:30: cash, yesterday&apos;s sales, stock to reorder and the one thing to do today,
          sent to {where} and to your phone if notifications are on there.</>
      )}
      foot={!allowed ? (
        ownPlan ? <Link className="pill pill-primary" href={`/checkout?plan=${requiredTier('scheduled_brief')}`}>See {needed}</Link> : null
      ) : on ? (
        <>
          <button type="button" className="pill pill-quiet" onClick={() => void setOn(false)} disabled={saving}>
            {saving ? 'Saving…' : 'Turn it off'}
          </button>
          <Link className="pill pill-quiet" href="/dashboard/profile">Change where it goes</Link>
        </>
      ) : (
        <button type="button" className="pill pill-primary" onClick={() => void setOn(true)} disabled={saving}>
          {saving ? 'Saving…' : 'Email me the brief'}
        </button>
      )}
    >
      {allowed && on && emailLive === false && (
        <p className="bento-note" style={{ marginTop: 8 }}>
          Email sending is not switched on at our end yet, so nothing is going out. Your setting is kept for when it is.
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="bento-note" style={{ marginTop: 8, color: 'var(--red)' }}>
          That did not save. Please try again.
        </p>
      )}
    </BentoCard>
  );
}
