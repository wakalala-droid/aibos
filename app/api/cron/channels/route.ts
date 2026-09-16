/**
 * GET /api/cron/channels — nightly pull of every Booking.com / Airbnb calendar.
 *
 * The API has had the sync (POST /hospitality/sync-all) since the iCal phase,
 * and nothing ever called it: /health/setup reported "channel_sync_cron: live"
 * because CRON_SECRET was set, while no scheduler existed. So a stay booked on
 * an OTA only reached the AI-BOS calendar when somebody pressed "Sync now", and
 * the property's own website could offer nights that were already sold.
 *
 * Called by Vercel Cron (vercel.json). Same two locks as /api/cron/briefs:
 * Vercel's Bearer CRON_SECRET here, X-Cron-Secret at the API.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { apiBase } from '@/lib/api-base';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = apiBase();
  if (!base.ok) {
    console.error('[cron/channels] %s', base.reason);
    return NextResponse.json(
      { error: 'The backend is not configured.', detail: base.reason },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${base.url}/hospitality/sync-all`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': secret },
      signal: AbortSignal.timeout(55_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error('[cron/channels] sync-all answered %s: %j', res.status, data);
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[cron/channels] %s', (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
