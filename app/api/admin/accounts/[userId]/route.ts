/**
 * GET /api/admin/accounts/[userId] — one account's profile, recent usage events,
 * and tier-change audit history. Admin-verified; service-role read.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-server';
import { createServiceClient } from '@/lib/supabase-admin';

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userId } = params;

  try {
    const admin = createServiceClient();

    const { data: profile, error: pErr } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

    const { data: events } = await admin
      .from('usage_events')
      .select('id, user_id, event, engine, meta, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: audit } = await admin
      .from('admin_audit')
      .select('id, admin_email, target_user_id, action, detail, created_at')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ profile, events: events ?? [], audit: audit ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
