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
import SectionCard from '@/components/ui/SectionCard';
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

  const body: React.CSSProperties = { fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: 0, lineHeight: 1.55 };
  const button: React.CSSProperties = {
    padding: '11px 16px', borderRadius: 10, border: 'none', fontSize: 'var(--fs-body)', fontWeight: 700,
    color: '#fff', background: 'var(--cyan)', cursor: status === 'saving' ? 'default' : 'pointer',
    opacity: status === 'saving' ? 0.6 : 1, textDecoration: 'none', textAlign: 'center',
  };

  return (
    <SectionCard title="AI Brief" subtitle="Your numbers, summarised, every morning by email and on your phone">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!allowed ? (
          <>
            <p style={body}>
              Every morning at 06:30: cash, yesterday&apos;s sales, stock to reorder and the one thing to do today,
              by email and as a notification on any phone or computer where you turned them on.
              {ownPlan ? ` It comes with ${needed}.` : ' It comes with a paid plan, which the business owner manages.'}
            </p>
            {ownPlan && <Link href={`/checkout?plan=${requiredTier('scheduled_brief')}`} style={button}>See {needed}</Link>}
          </>
        ) : on ? (
          <>
            <p role="status" style={body}>
              <strong style={{ color: 'var(--text-1)' }}>On.</strong> Your brief goes to {to || 'your account email'} every morning at 06:30
              and to every phone or computer where you turned notifications on.
            </p>
            {emailLive === false && (
              <p style={{ ...body, color: 'var(--warn)' }}>
                Email sending is not switched on at our end yet, so nothing is going out. Your setting is kept for when it is.
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => void setOn(false)} disabled={status === 'saving'}
                style={{ ...button, background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border-md)' }}>
                {status === 'saving' ? 'Saving…' : 'Turn it off'}
              </button>
              <Link href="/dashboard/profile" style={{ fontSize: 'var(--fs-data)', color: 'var(--cyan)' }}>
                Change where it goes
              </Link>
            </div>
          </>
        ) : (
          <>
            <p style={body}>
              Every morning at 06:30: cash, yesterday&apos;s sales, stock to reorder and the one thing to do today,
              sent to {to || 'your account email'} and to your phone if notifications are on there.
            </p>
            <button type="button" onClick={() => void setOn(true)} disabled={status === 'saving'} style={button}>
              {status === 'saving' ? 'Saving…' : 'Email me the brief'}
            </button>
          </>
        )}
        {status === 'error' && (
          <p role="alert" style={{ fontSize: 'var(--fs-data)', color: 'var(--crit)', margin: 0 }}>
            That did not save. Please try again.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
