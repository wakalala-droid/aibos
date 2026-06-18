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
  // Config presence (booleans only — never the secret) so prod env can be
  // verified without a session.
  const env = {
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    adminEmailsConfigured: Boolean(process.env.ADMIN_EMAILS),
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  };

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, isAdmin: false, env });
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
    env,
  });
}
