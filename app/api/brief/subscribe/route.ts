/**
 * POST /api/brief/subscribe — record an AI-brief email subscription.
 *
 * Replaces the old proxy call to a non-existent backend endpoint (which 404'd to
 * an HTML page → "Unexpected token '<'"). Persists durably to `usage_events`
 * (event='brief_subscribe') so a delivery job can pick it up later. No new table.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const session = await createServerComponentClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to subscribe.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; frequency?: string };
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const frequency = body.frequency === 'weekly' ? 'weekly' : 'daily';

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  try {
    const svc = createServiceClient();
    const { error } = await svc.from('usage_events').insert({
      user_id: user.id,
      event: 'brief_subscribe',
      meta: { email, frequency },
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, frequency });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
