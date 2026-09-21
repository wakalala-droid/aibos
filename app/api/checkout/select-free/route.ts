/**
 * POST /api/checkout/select-free — the caller chooses (or downgrades to) the
 * free plan for their OWN account.
 *
 * Tier is server-authoritative: the `profiles` guard trigger (migration 0010)
 * blocks users from writing their own `tier` directly, so even a downgrade must
 * go through the service-role client here. This route only ever touches the
 * authenticated caller's own row and can only set tier='free' — it can never
 * grant a paid tier (that path is the payment flow in aibos-api).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-admin';

export async function POST() {
  const session = await createServerComponentClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  }

  try {
    const svc = createServiceClient();
    // A card plan renews by itself (Paddle). Switching to Free here would leave
    // the card being charged for a plan the account no longer has, so the
    // renewal is cancelled first, on Plan & billing. Before migration 0037
    // there is no such table and nothing to stop.
    const { data: cards, error: cardErr } = await svc
      .from('card_subscriptions')
      .select('status,cancel_at')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due', 'paused']);
    if (!cardErr && (cards ?? []).some((c: { cancel_at: string | null }) => !c.cancel_at)) {
      return NextResponse.json({
        error: 'Your plan renews by itself on your card. Cancel the renewal on Plan & billing first, so the card is not charged for a plan you no longer have.',
      }, { status: 409 });
    }
    const { data, error } = await svc
      .from('profiles')
      .update({
        tier: 'free',
        subscription_tier: 'free',
        tier_source: 'self',
        tier_granted_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('tier')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, tier: data?.tier ?? 'free' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
