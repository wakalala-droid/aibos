/**
 * POST /api/admin/set-tier — promote/demote any account's tier.
 * Body: { targetUserId: string, tier: 'free'|'pro'|'growth', source?: string }
 *
 * Admin-verified; writes `profiles` (tier, tier_source, tier_granted_by/at) and
 * an `admin_audit` row, both via the service-role client.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-server';
import { createServiceClient } from '@/lib/supabase-admin';

const TIERS = ['free', 'pro', 'growth'] as const;
const SOURCES = ['self', 'payment', 'admin_demo'] as const;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    targetUserId?: string;
    tier?: string;
    source?: string;
  };

  const targetUserId = body.targetUserId;
  const tier = body.tier;
  const source = SOURCES.includes(body.source as (typeof SOURCES)[number])
    ? (body.source as string)
    : 'admin_demo';

  if (!targetUserId || !TIERS.includes(tier as (typeof TIERS)[number])) {
    return NextResponse.json({ error: 'targetUserId and a valid tier are required.' }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from('profiles')
      .update({
        tier,
        tier_source: source,
        tier_granted_by: auth.user.email,
        tier_granted_at: now,
        // Mirror into the legacy column so any old reader stays consistent.
        subscription_tier: tier,
      })
      .eq('id', targetUserId)
      .select('id, email, tier, tier_source, tier_granted_by, tier_granted_at')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

    await admin.from('admin_audit').insert({
      admin_email: auth.user.email,
      target_user_id: targetUserId,
      action: 'set_tier',
      detail: { tier, source },
    });

    return NextResponse.json({ ok: true, profile: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
