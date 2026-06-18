/**
 * GET /api/admin/usage — aggregate usage metrics for the admin dashboard.
 * Admin-verified; service-role read. Aggregation done in JS over the last 30 days
 * of events (cheap at this scale; revisit with a SQL rollup if volume grows).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-server';
import { createServiceClient } from '@/lib/supabase-admin';
import type { UsageAggregate } from '@/lib/admin';

const DAY = 86_400_000;
const dayKey = (iso: string) => iso.slice(0, 10); // YYYY-MM-DD

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const admin = createServiceClient();
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY).toISOString();
    const cutoff7 = now - 7 * DAY;

    const [{ count: totalAccounts }, eventsRes] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('usage_events').select('user_id, event, created_at').gte('created_at', since30),
    ]);

    const events = (eventsRes.data ?? []) as { user_id: string; event: string; created_at: string }[];

    let uploads7 = 0,
      uploads30 = 0,
      chats7 = 0,
      chats30 = 0;
    const activeSet = new Set<string>();
    const perUser = new Map<string, number>();

    // Pre-seed a 30-day series so the chart has continuous days.
    const series: Record<string, { uploads: number; chats: number; total: number }> = {};
    for (let i = 29; i >= 0; i--) {
      series[dayKey(new Date(now - i * DAY).toISOString())] = { uploads: 0, chats: 0, total: 0 };
    }

    for (const ev of events) {
      const t = new Date(ev.created_at).getTime();
      activeSet.add(ev.user_id);
      perUser.set(ev.user_id, (perUser.get(ev.user_id) ?? 0) + 1);
      const k = dayKey(ev.created_at);
      const bucket = series[k];
      if (bucket) bucket.total += 1;
      if (ev.event === 'upload') {
        uploads30 += 1;
        if (t >= cutoff7) uploads7 += 1;
        if (bucket) bucket.uploads += 1;
      } else if (ev.event === 'chat') {
        chats30 += 1;
        if (t >= cutoff7) chats7 += 1;
        if (bucket) bucket.chats += 1;
      }
    }

    // Top 5 accounts by event volume, resolved to a name.
    const topIds = [...perUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    let topAccounts: UsageAggregate['topAccounts'] = [];
    if (topIds.length) {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, business_name, email')
        .in(
          'id',
          topIds.map(([id]) => id)
        );
      const byId = new Map((profs ?? []).map((p) => [p.id as string, p]));
      topAccounts = topIds.map(([id, count]) => ({
        user_id: id,
        business_name: (byId.get(id)?.business_name as string | null) ?? null,
        email: (byId.get(id)?.email as string | null) ?? null,
        events: count,
      }));
    }

    const payload: UsageAggregate = {
      totalAccounts: totalAccounts ?? 0,
      activeAccounts30: activeSet.size,
      uploads7,
      uploads30,
      chats7,
      chats30,
      series: Object.entries(series).map(([date, v]) => ({ date, ...v })),
      topAccounts,
    };

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
