/**
 * GET /api/cron/briefs — scheduled trigger for Morning Brief delivery.
 *
 * Called by Vercel Cron (see vercel.json: 04:30 UTC = 06:30 Lusaka daily).
 * Verifies Vercel's Authorization header (Bearer CRON_SECRET — Vercel adds it
 * automatically when the CRON_SECRET env var is set), then forwards to the
 * backend dispatcher with the X-Cron-Secret header the backend requires.
 * Two locks, one key: nobody can trigger a mass send from outside.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiBase } from '@/lib/api-base';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  /*
    A cron that quietly posts to a dead host every morning is the worst kind of
    broken: it reports success to the scheduler and nobody hears about it for
    weeks. Say so instead. The address had the old Railway URL hardcoded as its
    fallback, which is exactly that failure waiting to happen.
  */
  const base = apiBase();
  if (!base.ok) {
    console.error('[cron/briefs] %s', base.reason);
    return NextResponse.json(
      { error: 'The backend is not configured.', detail: base.reason },
      { status: 503 },
    );
  }
  const BACKEND = base.url;

  try {
    const res = await fetch(`${BACKEND}/notify/dispatch-briefs`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': secret },
      // Dispatch iterates every opted-in user — give it room.
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
