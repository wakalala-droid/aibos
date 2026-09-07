/**
 * GET /api/health — is this deployment actually wired up?
 *
 * WHY THIS EXISTS. Both halves of AI-BOS hold a Supabase key, in two different
 * dashboards, under two different variable names: SUPABASE_SERVICE_ROLE_KEY on
 * the web host and SUPABASE_SERVICE_KEY on the API host. Both must be the
 * *service_role* key. Paste the anon key into either one and nothing errors:
 * the client is created, requests return 200, and every read comes back EMPTY
 * because Row Level Security is doing its job against a key with no rights.
 *
 * Downstream that reads as ordinary emptiness. A paying customer's plan reads
 * as absent, so the app tells them to upgrade to the plan they already bought,
 * and their data looks like it was never saved. Nothing anywhere says "wrong
 * key" — which is why one wrong paste cost a day of looking in the wrong place.
 *
 * So this route asks the only question that settles it: can this key list
 * users? That endpoint is service_role-only. It answers for the web half here
 * and reports the API half's own answer alongside, so ONE address tells you
 * whether the deployment is sound.
 *
 * It returns booleans and explanations. No keys, no URLs, nothing secret.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiBase } from '@/lib/api-base';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface KeyVerdict {
  configured: boolean;
  service_role: boolean;
  note: string;
}

async function checkServiceKey(): Promise<KeyVerdict> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return {
      configured: false,
      service_role: false,
      note:
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set ' +
        'on the web host. Without them nobody can sign in.',
    };
  }

  try {
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      return {
        configured: true,
        service_role: false,
        note:
          'SUPABASE_SERVICE_ROLE_KEY is set but it is NOT the service_role key. ' +
          `Listing users was refused (${error.message}). Copy the service_role key ` +
          'from Supabase → Project Settings → API and redeploy.',
      };
    }
    return { configured: true, service_role: true, note: 'ok' };
  } catch (e) {
    return {
      configured: true,
      service_role: false,
      note: `The key could not be checked: ${(e as Error).message}`,
    };
  }
}

export async function GET() {
  const web = await checkServiceKey();
  const base = apiBase();

  let api: Record<string, unknown> = base.ok
    ? { reachable: false, note: 'The API did not answer.' }
    : { reachable: false, note: base.reason };

  if (base.ok) {
    try {
      // A free API host sleeps after 15 idle minutes and takes up to a minute
      // to wake, so this waits longer than a normal call would.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 75_000);
      const r = await fetch(`${base.url}/health`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      api = r.ok
        ? { reachable: true, ...(await r.json()) }
        : { reachable: false, note: `The API answered ${r.status}.` };
    } catch (e) {
      api = { reachable: false, note: `The API could not be reached: ${(e as Error).message}` };
    }
  }

  const apiKeyOk = api.reachable === true ? api.db_service_role === true : null;
  const healthy = web.service_role && apiKeyOk === true;

  return NextResponse.json(
    {
      healthy,
      web,
      api,
      // The one sentence to read when healthy is false.
      verdict: healthy
        ? 'Both halves are wired up correctly.'
        : !web.service_role
          ? `Web host: ${web.note}`
          : apiKeyOk === false
            ? `API host: ${api.db_note ?? 'its Supabase key cannot see the database.'}`
            : `API host: ${api.note ?? 'not reachable.'}`,
    },
    { status: healthy ? 200 : 503 },
  );
}
