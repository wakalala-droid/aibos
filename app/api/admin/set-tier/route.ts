/**
 * POST /api/admin/set-tier — promote/demote any account's tier.
 * Body: { targetUserId: string, tier: Tier, source?: string, billing?: 'monthly' | 'annual' }
 * `tier` is validated against the ladder in lib/tiers.ts, not a list kept here.
 *
 * Admin-verified; writes `profiles` (tier, tier_source, tier_granted_by/at,
 * paid_until) and an `admin_audit` row, both via the service-role client.
 *
 * source 'payment' records a payment taken by hand (mobile money sent to the
 * merchant number while collections are not switched on). It is bought for a
 * period exactly like a checkout: `paid_until` is set a month or a year out,
 * and a renewal of the same plan before it ends extends from the old end date
 * (the same rule as aibos-api paid_period_end). Without this the only buttons
 * were demo grants that never end, so a customer who paid for one month kept
 * the plan for ever, and a lapsed customer who paid again still read as lapsed
 * because their old end date was left behind.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-server';
import { createServiceClient } from '@/lib/supabase-admin';
// isTier is derived from TIER_ORDER — a hand-written list here would silently
// reject (or, worse, accept) a tier the rest of the app knows about.
import { isTier } from '@/lib/tiers';

const SOURCES = ['self', 'payment', 'admin_demo'] as const;
/** Days a paid period lasts. Keep in step with aibos-api main.PERIOD_DAYS. */
const PERIOD_DAYS = { monthly: 31, annual: 366 } as const;
const DAY = 86_400_000;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    targetUserId?: string;
    tier?: string;
    source?: string;
    billing?: string;
  };

  const targetUserId = body.targetUserId;
  const tier = body.tier;
  const source = SOURCES.includes(body.source as (typeof SOURCES)[number])
    ? (body.source as string)
    : 'admin_demo';
  const billing = body.billing === 'annual' ? 'annual' : 'monthly';

  if (!targetUserId || !isTier(tier)) {
    return NextResponse.json({ error: 'targetUserId and a valid tier are required.' }, { status: 400 });
  }
  if (source === 'payment' && tier === 'free') {
    return NextResponse.json({ error: 'A payment is for a paid plan.' }, { status: 400 });
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
        .select('tier, tier_source, paid_until')
        .eq('id', targetUserId)
        .maybeSingle();
      const until = current?.tier_source === 'payment' && current?.paid_until ? new Date(current.paid_until as string) : null;
      const extend = until && current?.tier === tier && until.getTime() > now.getTime();
      const start = extend ? (until as Date) : now;
      patch.paid_until = new Date(start.getTime() + PERIOD_DAYS[billing] * DAY).toISOString();
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
      detail: { tier, source, ...(source === 'payment' ? { billing, paid_until: patch.paid_until ?? null } : {}) },
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
