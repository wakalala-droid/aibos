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

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://aibos-api-production.up.railway.app';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND.replace(/\/$/, '')}/notify/dispatch-briefs`, {
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
