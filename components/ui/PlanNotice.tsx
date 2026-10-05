'use client';

/**
 * PlanNotice — the one strip that talks about the plan itself.
 *
 * 1. When the app cannot confirm which plan you are on.
 *    The interface keeps its own copy of your plan so screens can lock and
 *    unlock instantly. That copy outlives a sign-out, and it outlived a rebuilt
 *    database. When the API cannot read the real answer, the two disagree: paid
 *    screens open as normal and then every button behind them refuses. What the
 *    owner sees is "upgrade to Pro" on a plan they already pay for, with nothing
 *    to argue with. This says the check failed, that it is our fault, and
 *    offers to try again.
 *
 * 2. When a paid plan has ended or is about to.
 *    Every plan is paid by card and renews automatically (25 September 2026),
 *    so a card plan that is still going is never "about to end": its end date
 *    is its next renewal. A plan paid for a fixed period before the switch (by
 *    mobile money, or recorded by hand) does end, and is asked to set up card
 *    payment. Without this, the first sign of a lapsed plan was every paid
 *    screen asking to "upgrade" to the plan the owner had already bought.
 *    Someone working in a business that invited them is told to ask the owner,
 *    because only the owner can pay.
 */

import { useState } from 'react';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import { useProfile } from '@/lib/profile';
import { TIERS } from '@/lib/tiers';

/** Warn this many days before a paid period ends. */
const WARN_DAYS = 5;
/** Paid features keep working this long after the period ends (entitlements.py GRACE_DAYS). */
const GRACE_DAYS = 7;
const DAY = 86_400_000;

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PlanNotice() {
  const { planConfirmed, planNote, loading, refresh, planExpired, paidTier, paidUntil, renewsAutomatically, ownPlan, serverTier } = useProfile();
  const [retrying, setRetrying] = useState(false);

  if (loading) return null;

  if (!planConfirmed) {
    return (
      <Strip
        title="We could not check your plan"
        tag="Check"
        body={planNote}
        action={
          <button
            type="button"
            onClick={async () => { setRetrying(true); await refresh(); setRetrying(false); }}
            disabled={retrying}
            className="pill pill-quiet"
            style={{ cursor: retrying ? 'default' : 'pointer', opacity: retrying ? 0.6 : 1 }}
          >
            {retrying ? 'Checking…' : 'Check again'}
          </button>
        }
      />
    );
  }

  if (planExpired && paidTier && paidTier !== 'free') {
    const name = TIERS[paidTier].name;
    return ownPlan ? (
      <Strip
        ended
        title={`Your ${name} plan has ended`}
        body={`${paidUntil ? `It ran until ${longDate(paidUntil)}. ` : ''}Your records are all still here. Set up card payment to switch ${name} back on. It then renews automatically.`}
        action={<Link href={`/checkout?plan=${paidTier}`} className="pill pill-primary" style={actionStyle}>Set up card payment</Link>}
      />
    ) : (
      <Strip
        ended
        title={`This business's ${name} plan has ended`}
        body="Some screens are locked until the owner renews it. Nothing you recorded is lost."
      />
    );
  }

  if (ownPlan && paidUntil && serverTier && serverTier !== 'free' && !renewsAutomatically) {
    const end = new Date(paidUntil).getTime();
    const now = Date.now();
    if (Number.isFinite(end) && end - now < WARN_DAYS * DAY) {
      const name = TIERS[serverTier].name;
      const ended = end <= now;
      const off = longDate(new Date(end + GRACE_DAYS * DAY).toISOString());
      return (
        <Strip
          ended={ended}
          title={ended ? `Your ${name} plan ended on ${longDate(paidUntil)}` : `Your ${name} plan is paid up to ${longDate(paidUntil)}`}
          body={ended
            ? `Everything stays on until ${off}. Set up card payment before then to keep ${name} without a break. It then renews automatically.`
            : `To keep ${name} on after that, set up card payment on or just before that day. It then renews automatically until you cancel.`}
          action={<Link href={`/checkout?plan=${serverTier}`} className="pill pill-primary" style={actionStyle}>Set up card payment</Link>}
        />
      );
    }
  }

  return null;
}

function Strip({ title, body, action, ended, tag }: { title: string; body: string; action?: React.ReactNode; ended?: boolean; tag?: string }) {
  // The splash's pieces (the owner, 5 Oct 2026): a round card icon, the
  // subject in spaced capitals, the sentence in bold, then the words.
  return (
    <Notice icon={CreditCard} title="Your plan" tag={tag ?? (ended ? 'Ended' : 'Renewal')} bad={ended}
      actions={action} style={{ margin: '0 0 16px' }}>
      <strong>{title}.</strong> {body}
    </Notice>
  );
}

const actionStyle: React.CSSProperties = { textDecoration: 'none' };
