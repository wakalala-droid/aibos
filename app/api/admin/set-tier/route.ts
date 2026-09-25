/**
 * POST /api/admin/set-tier — promote/demote any account's tier.
 * Body: { targetUserId: string, tier: Tier, source?: string, billing?: 'monthly' | 'annual',
 *         schedule?: 'join_date' }
 * `tier` is validated against the ladder in lib/tiers.ts, not a list kept here.
 *
 * Admin-verified; writes `profiles` (tier, tier_source, tier_granted_by/at,
 * paid_until) and an `admin_audit` row, both via the service-role client.
 *
 * source 'payment' records a payment taken by hand (a customer who paid AIBOS
 * directly instead of by card). It records the amount and currency, in US
 * dollars like every plan price, and is bought for a period: `paid_until` is set a month or a year out,
 * and a renewal of the same plan before it ends extends from the old end date
 * (the same rule as aibos-api paid_period_end). Without this the only buttons
 * were demo grants that never end, so a customer who paid for one month kept
 * the plan for ever, and a lapsed customer who paid again still read as lapsed
 * because their old end date was left behind.
 *
 * schedule 'join_date' (with source 'payment') puts an account on billing
 * without recording money: the plan runs to the next date on the day of the
 * month they joined, and from then the renewal run (aibos-api billing.py)
 * reminds them and asks for payment on that day every period.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-server';
import { createServiceClient } from '@/lib/supabase-admin';
// isTier is derived from TIER_ORDER — a hand-written list here would silently
// reject (or, worse, accept) a tier the rest of the app knows about.
import { isTier, TIERS, PRICE_CURRENCY } from '@/lib/tiers';

const SOURCES = ['self', 'payment', 'admin_demo'] as const;
const DAY = 86_400_000;
/** Paid features keep working this long after a period ends (entitlements.py GRACE_DAYS). */
const GRACE_DAYS = 7;

/** One period on, on the anchor day of the month. A month without that day
 *  ends on its last day. Keep in step with aibos-api billing.add_period. */
function addPeriod(start: Date, billing: 'monthly' | 'annual', anchorDay?: number): Date {
  const day = anchorDay ?? start.getUTCDate();
  const year = billing === 'annual' ? start.getUTCFullYear() + 1 : start.getUTCFullYear() + Math.floor((start.getUTCMonth() + 1) / 12);
  const month = billing === 'annual' ? start.getUTCMonth() : (start.getUTCMonth() + 1) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, last), start.getUTCHours(),
    start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()));
}

/** The day a renewal lands on: the end date's, unless a short month cut it
 *  and the join day is later. Keep in step with aibos-api billing.anchor_for. */
function anchorFor(until: Date, joined: Date | null): number {
  const day = until.getUTCDate();
  const last = new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth() + 1, 0)).getUTCDate();
  return day === last && joined && joined.getUTCDate() > day ? joined.getUTCDate() : day;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    targetUserId?: string;
    tier?: string;
    source?: string;
    billing?: string;
    schedule?: string;
  };

  const targetUserId = body.targetUserId;
  const tier = body.tier;
  const source = SOURCES.includes(body.source as (typeof SOURCES)[number])
    ? (body.source as string)
    : 'admin_demo';
  const billing = body.billing === 'annual' ? 'annual' : 'monthly';
  const fromJoin = body.schedule === 'join_date';

  if (!targetUserId || !isTier(tier)) {
    return NextResponse.json({ error: 'targetUserId and a valid tier are required.' }, { status: 400 });
  }
  if (source === 'payment' && tier === 'free') {
    return NextResponse.json({ error: 'A payment is for a paid plan.' }, { status: 400 });
  }
  if (fromJoin && source !== 'payment') {
    return NextResponse.json({ error: 'Billing from the join date is for a paid plan.' }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const now = new Date();

    const patch: Record<string, unknown> = {
      tier,
      tier_source: source,
      tier_granted_by: auth.user.email,
      tier_granted_at: now.toISOString(),
      // Mirror into the legacy column so any old reader stays consistent.
      subscription_tier: tier,
      // Only a payment has a period. Anything else clears a stale one.
      paid_until: null,
    };

    if (source === 'payment') {
      const { data: current } = await admin
        .from('profiles')
        .select('tier, tier_source, paid_until, created_at')
        .eq('id', targetUserId)
        .maybeSingle();
      const joined = current?.created_at ? new Date(current.created_at as string) : null;
      if (fromJoin) {
        if (!joined) return NextResponse.json({ error: 'This account has no join date.' }, { status: 400 });
        // The next date on the day they joined that is still to come.
        let next = joined;
        while (next.getTime() <= now.getTime()) next = addPeriod(next, billing, joined.getUTCDate());
        patch.paid_until = next.toISOString();
      } else {
        // The same plan paid before it ends, or in the week of grace after,
        // runs on from the old end date so the billing day never moves.
        const until = current?.tier_source === 'payment' && current?.paid_until ? new Date(current.paid_until as string) : null;
        const extend = until && current?.tier === tier && now.getTime() < until.getTime() + GRACE_DAYS * DAY;
        patch.paid_until = (extend
          ? addPeriod(until as Date, billing, anchorFor(until as Date, joined))
          : addPeriod(now, billing)).toISOString();
      }
    }

    let result = await admin
      .from('profiles')
      .update(patch)
      .eq('id', targetUserId)
      .select('id, email, tier, tier_source, tier_granted_by, tier_granted_at')
      .maybeSingle();

    // Before migration 0033 there is no paid_until column. The plan change
    // still has to happen; it simply has no end date until the migration runs.
    let noPeriod = false;
    if (result.error && /paid_until/.test(result.error.message)) {
      delete patch.paid_until;
      noPeriod = true;
      result = await admin
        .from('profiles')
        .update(patch)
        .eq('id', targetUserId)
        .select('id, email, tier, tier_source, tier_granted_by, tier_granted_at')
        .maybeSingle();
    }

    const { data, error } = result;
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

    await admin.from('admin_audit').insert({
      admin_email: auth.user.email,
      target_user_id: targetUserId,
      action: 'set_tier',
      detail: {
        tier, source,
        ...(source === 'payment' ? { billing, paid_until: patch.paid_until ?? null } : {}),
        // Money actually received (not for putting an account on billing),
        // so payment history never has to guess it from a later price list.
        ...(source === 'payment' && !fromJoin && tier !== 'free'
          ? { amount: billing === 'annual' ? TIERS[tier].priceAnnual : TIERS[tier].priceMonthly, currency: PRICE_CURRENCY }
          : {}),
        ...(fromJoin ? { schedule: 'join_date' } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      profile: { ...data, paid_until: patch.paid_until ?? null },
      note: noPeriod && source === 'payment'
        ? 'Saved without an end date: run migration 0033 so paid plans can end.'
        : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
