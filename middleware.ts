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
// Everything that needs an account. Checkout, onboarding and the data studio
// were open, so a signed-out visitor who chose a plan on the pricing page got
// as far as "Pay" and was then refused with a raw "Unauthenticated" error.
const PROTECTED_PREFIXES = ['/dashboard', '/checkout', '/onboarding', '/data-studio'];
const ADMIN_PREFIX     = '/admin';

/** Where to come back to after signing in: the page AND its query, so
 *  /checkout?plan=pro is not reduced to a checkout with no plan. */
function returnPath(request: NextRequest): string {
  return request.nextUrl.pathname + request.nextUrl.search;
}

/** A redirect target from a query string, only if it stays on this site. */
function safeReturnPath(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/dashboard';
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected  = PROTECTED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
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
      loginUrl.searchParams.set('redirectTo', returnPath(request));
      return NextResponse.redirect(loginUrl);
    }
    // Public / marketing / login / auth-callback → serve as signed-out.
    return response;
  }

  // Defensive: unreachable on the success path, but narrows `supabase` to
  // non-null for the admin query below and keeps the guarantee explicit.
  if (!supabase) return response;

  // 0. Admin area — must be signed in AND on the ADMIN_EMAILS allowlist.
  //    Non-admins get a clean redirect to /dashboard, not a 404.
  //
  //    Verified with getUser() here, not the cookie alone, and never
  //    profiles.role: a user could insert their own profile as an admin until
  //    migration 0033 (see lib/admin-server.ts). Every /api/admin route checks
  //    again on its own.
  if (isAdminRoute) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', returnPath(request));
      return NextResponse.redirect(loginUrl);
    }
    const { data: verified } = await supabase.auth.getUser();
    if (!isAdminEmail(verified.user?.email)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 1. User is not logged in and trying to access protected route
  if (isProtected && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', returnPath(request));
    return NextResponse.redirect(loginUrl);
  }

  // 2. User IS logged in and trying to access login page → where they were
  //    going (a same-site path only), else the dashboard.
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL(safeReturnPath(request.nextUrl.searchParams.get('redirectTo')), request.url));
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
