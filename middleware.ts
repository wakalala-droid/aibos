/**
 * AI-BOS — Route Protection Middleware
 * Runs on every request. Checks Supabase session.
 * Protected routes → /dashboard/**, /admin/**
 * Public routes    → /login, /auth/callback, and the marketing surface
 *                    (/ home, plus /pricing, /trust, /about).
 * Root: signed-in → /dashboard; signed-out → public marketing home.
 *
 * Resilience: if the auth backend can't be reached (e.g. the public Supabase
 * env vars are missing/misconfigured), we MUST NOT 404 the public marketing
 * site. We fail OPEN for public routes (serve the signed-out experience) and
 * fail CLOSED for guarded routes (redirect to /login) so nothing protected
 * leaks when auth can't be evaluated.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createMiddlewareClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

// ─── Route Configuration ──────────────────────────────────────────────────────

// The marketing pages ('/', '/pricing', '/trust', '/about') are public by virtue
// of not matching the protected/admin prefixes below — they fall through to
// `response`. Only the auth/guarded routes below need explicit handling.
const AUTH_ROUTES   = ['/login'];          // Redirect to dashboard if already logged in
const PROTECTED_PREFIX = '/dashboard';
const ADMIN_PREFIX     = '/admin';

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected  = pathname.startsWith(PROTECTED_PREFIX);
  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isAuthRoute  = AUTH_ROUTES.some(r => pathname === r);
  const isGuarded    = isProtected || isAdminRoute;

  // Construct the client and read the session inside a guard so an auth-backend
  // outage never takes down public pages (see file header).
  let response = NextResponse.next({ request: { headers: request.headers } });
  let supabase: SupabaseClient | null = null;
  let session: Session | null = null;

  try {
    const client = createMiddlewareClient(request);
    supabase = client.supabase;
    response = client.response;
    // Refresh session — required by @supabase/ssr on every request
    const { data } = await supabase.auth.getSession();
    session = data.session;
  } catch (err) {
    console.error('[AI-BOS middleware] auth unavailable:', err);
    if (isGuarded) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Public / marketing / login / auth-callback → serve as signed-out.
    return response;
  }

  // Defensive: unreachable on the success path, but narrows `supabase` to
  // non-null for the admin query below and keeps the guarantee explicit.
  if (!supabase) return response;

  // 0. Admin area — must be signed in AND an admin (allowlist OR profiles.role).
  //    Non-admins get a clean redirect to /dashboard, not a 404.
  if (isAdminRoute) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
    let admin = isAdminEmail(session.user.email);
    if (!admin) {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      admin = (data?.role as string | undefined) === 'admin';
    }
    if (!admin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 1. User is not logged in and trying to access protected route
  if (isProtected && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. User IS logged in and trying to access login page → send to dashboard
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 3. Root path — signed-in users go straight to their dashboard (preserve the
  //    habit). Signed-out visitors fall through to the public marketing home.
  if (pathname === '/' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

// ─── Matcher — apply to all routes except static assets ──────────────────────

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|images|fonts|marketing|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)',
  ],
};
