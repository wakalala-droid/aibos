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

    const [{ count: totalAccounts }, eventsRes, profilesRes, funnelRes] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('usage_events').select('user_id, event, created_at').gte('created_at', since30),
      admin.from('profiles').select('id, onboarded_at'),
      // All-time funnel-stage events. Same revisit-with-a-SQL-rollup caveat as above.
      admin
        .from('usage_events')
        .select('user_id, event, created_at')
        .in('event', ['event_recorded', 'upload', 'engine_view', 'brief_viewed']),
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

    // ── Activation funnel (audit #14) ────────────────────────────────────────
    const profiles = (profilesRes.data ?? []) as { id: string; onboarded_at: string | null }[];
    const funnelEvents = (funnelRes.data ?? []) as { user_id: string; event: string; created_at: string }[];

    const recordedBy = new Map<string, number[]>(); // user → recording timestamps
    const insightSet = new Set<string>();
    for (const ev of funnelEvents) {
      if (ev.event === 'event_recorded' || ev.event === 'upload') {
        const list = recordedBy.get(ev.user_id) ?? [];
        list.push(new Date(ev.created_at).getTime());
        recordedBy.set(ev.user_id, list);
      } else {
        insightSet.add(ev.user_id);
      }
    }

    // Habit: recorded on ≥3 distinct days within 7 days of the user's first
    // recording. Only users whose first recording is >7 days old count in the
    // denominator — younger accounts haven't had the chance yet.
    let habitFormed = 0;
    let habitEligible = 0;
    for (const stamps of recordedBy.values()) {
      const first = Math.min(...stamps);
      if (now - first < 7 * DAY) continue;
      habitEligible += 1;
      const days = new Set(
        stamps.filter((t) => t - first < 7 * DAY).map((t) => dayKey(new Date(t).toISOString()))
      );
      if (days.size >= 3) habitFormed += 1;
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
      funnel: {
        signups: totalAccounts ?? profiles.length,
        onboarded: profiles.filter((p) => p.onboarded_at).length,
        recordedData: recordedBy.size,
        sawInsight: insightSet.size,
        habitFormed,
        habitEligible,
        trackedSince: '2026-07-13', // event_recorded instrumentation start
      },
    };

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
