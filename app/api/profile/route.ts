/**
 * AIBOS — Current user's profile (server-resolved).
 *
 * The browser cannot reliably read its own `profiles` row directly (RLS on the
 * existing table blocks the self-select, so client reads come back null). This
 * route resolves the caller from their session, then reads/provisions their row
 * with the service-role client (which bypasses RLS) and returns the row plus the
 * authoritative `isAdmin` verdict. It only ever touches the caller's OWN row.
 *
 * GET   → { profile, isAdmin }
 * PATCH → update the caller's own editable profile fields, returns { profile }
 */

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-admin';
import { isAdminUser } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Columns a user may edit on their own profile (no role/tier escalation here).
const EDITABLE = [
  'business_name',
  'business_type',
  'industry',
  'location',
  'currency',
  'phone',
  'whatsapp',
  'contact_email',
  'logo_url',
  'website',
  // Identity provenance (migration 0026): set when the owner confirms a match
  // found by /identity/lookup. Editable by the user because THEY are the one
  // confirming it — nothing here is a privilege, only a record of where their
  // own details came from.
  'identity_place_id',
  'identity_source',
  'identity_confirmed_at',
  // Morning Brief delivery (migration 0013): tier is enforced server-side at
  // dispatch (aibos-api), so storing the preference itself is safe for anyone.
  'brief_email_enabled',
  'whatsapp_number',
  // Which plan's welcome this account has closed (migration 0028). A
  // preference, not a privilege: it only decides whether a panel is on screen,
  // and the profiles guard trigger still pins role and tier on a self-update.
  'welcome_seen_tier',
  // Onboarding fields (migration 0007 · Evolution Initiative 1).
  'tax_status',
  'employees',
  'operating_hours',
  'language',
  'onboarded_at',
] as const;

export async function GET() {
  const session = await createServerComponentClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const svc = createServiceClient();

  // Provision (idempotent) then read the caller's own row, RLS-free.
  await svc
    .from('profiles')
    .upsert({ id: user.id, email: user.email }, { onConflict: 'id', ignoreDuplicates: true });

  const { data: profile } = await svc
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // The allowlist, proven by Google (lib/admin.ts isAdminUser). Never
  // profiles.role, a value a user could write for themselves until migration
  // 0033 (see lib/admin-server.ts).
  const isAdmin = isAdminUser(user);

  return NextResponse.json({ profile, isAdmin });
}

export async function PATCH(request: Request) {
  const session = await createServerComponentClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) patch[key] = body[key];
  }
  patch.updated_at = new Date().toISOString();

  const svc = createServiceClient();

  /*
    SAVE WHAT THE DATABASE CAN HOLD, AND SAY WHAT IT COULD NOT.

    PostgREST refuses a whole update if it names one column the table does not
    have. The live database was found without migration 0026, and onboarding
    always sends `website` and the identity fields, so finishing setup failed
    for every new customer with "Could not complete setup." One missing column
    cost them every other field on the form.

    Now a missing column is dropped and the rest is saved. The response lists
    what was skipped so nothing is silently lost, and the log says which
    migration to run.
  */
  const skipped: string[] = [];
  for (let attempt = 0; attempt <= EDITABLE.length; attempt++) {
    const { data: profile, error } = await svc
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select('*')
      .maybeSingle();

    if (!error) {
      if (skipped.length) {
        console.error('[api/profile] saved without missing column(s) %s: run the pending Supabase migrations', skipped.join(', '));
      }
      return NextResponse.json({ profile, skipped });
    }

    const missing = missingColumn(error);
    if (!missing || !(missing in patch)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    delete patch[missing];
    skipped.push(missing);
  }
  return NextResponse.json({ error: 'The profile could not be saved.' }, { status: 500 });
}

/** The column a PostgREST error says is missing, if that is what it says. */
function missingColumn(error: { code?: string; message?: string }): string | null {
  const text = error.message ?? '';
  // PGRST204: "Could not find the 'website' column of 'profiles' in the schema cache"
  // 42703:    'column profiles.website does not exist'
  const m = text.match(/'([a-z0-9_]+)' column of/i) ?? text.match(/column [a-z0-9_]+\.([a-z0-9_]+) does not exist/i);
  return m ? m[1] : null;
}
