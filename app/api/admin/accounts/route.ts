/**
 * GET /api/admin/accounts — list every account + usage counts.
 * Admin-verified; uses the service-role client (bypasses RLS) to read all rows.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-server';
import { createServiceClient } from '@/lib/supabase-admin';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from('admin_account_overview')
      .select('*')
      .order('last_event_at', { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ accounts: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
