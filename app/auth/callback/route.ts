/**
 * AI-BOS — OAuth Callback Handler
 * Route: /auth/callback
 *
 * After Google OAuth completes, Supabase redirects here with ?code=...
 * This route exchanges the code for a session and redirects to /dashboard
 *
 * This is a Server Route Handler (not a page) — it never renders HTML.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code        = searchParams.get('code');
  const redirectTo  = searchParams.get('redirectTo') ?? '/dashboard';
  const error       = searchParams.get('error');
  const errorDesc   = searchParams.get('error_description');

  // ── OAuth error from Google/Supabase ──────────────────────────────────────
  if (error) {
    console.error(`[AI-BOS Auth] OAuth error: ${error} — ${errorDesc}`);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', error);
    loginUrl.searchParams.set('error_description', errorDesc ?? 'Authentication failed');
    return NextResponse.redirect(loginUrl);
  }

  // ── No code present ───────────────────────────────────────────────────────
  if (!code) {
    console.error('[AI-BOS Auth] No code param in callback URL');
    return NextResponse.redirect(new URL('/login?error=no_code', origin));
  }

  // ── Exchange code for session ─────────────────────────────────────────────
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[AI-BOS Auth] Session exchange error:', exchangeError.message);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'session_exchange_failed');
    loginUrl.searchParams.set('error_description', exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  // ── Ensure profile exists in DB ───────────────────────────────────────────
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const fullName = (user.user_metadata?.full_name as string | undefined) ?? null;
      // Provision the profile row on first login. ignoreDuplicates means existing
      // rows (with a real business_name / tier / role) are never overwritten;
      // new rows get the server-authoritative defaults, including an admin role
      // for allowlisted emails so the first admin works before any seed runs.
      await supabase.from('profiles').upsert({
        id:                user.id,
        email:             user.email!,
        full_name:         fullName,
        avatar_url:        (user.user_metadata?.avatar_url as string | undefined) ?? null,
        business_name:     fullName,
        role:              isAdminEmail(user.email) ? 'admin' : 'member',
        tier:              'free',
        tier_source:       'self',
        subscription_tier: 'free',
      }, { onConflict: 'id', ignoreDuplicates: true });
    }
  } catch (profileError) {
    // Non-fatal — user can still use the app
    console.warn('[AI-BOS Auth] Profile upsert failed (non-fatal):', profileError);
  }

  // ── Success → redirect to dashboard (or intended route) ──────────────────
  const successUrl = new URL(
    redirectTo.startsWith('/') ? redirectTo : '/dashboard',
    origin
  );

  return NextResponse.redirect(successUrl);
}
