/**
 * AI-BOS — Diagnostic: who does the server think you are?
 *
 * Returns ONLY the caller's own identity + admin verdict. No service-role key,
 * no other accounts. Hit this in a browser while signed in to see exactly which
 * account that session belongs to and whether the server treats it as admin.
 */

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, isAdmin: false });
  }

  const viaAllowlist = isAdminEmail(user.email);
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const viaRole = (profile?.role as string | undefined) === 'admin';

  return NextResponse.json({
    authenticated: true,
    email: user.email,
    userId: user.id,
    profileRole: profile?.role ?? null,
    isAdmin: viaAllowlist || viaRole,
    adminVia: viaAllowlist ? 'email-allowlist' : viaRole ? 'profile-role' : 'none',
  });
}
