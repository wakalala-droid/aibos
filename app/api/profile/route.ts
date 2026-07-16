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
import { isAdminEmail } from '@/lib/admin';

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
  // Morning Brief delivery (migration 0013): tier is enforced server-side at
  // dispatch (aibos-api), so storing the preference itself is safe for anyone.
  'brief_email_enabled',
  'whatsapp_number',
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

  const role = (profile?.role as string | undefined) ?? 'member';
  const isAdmin = isAdminEmail(user.email) || role === 'admin';

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
  const { data: profile, error } = await svc
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile });
}
