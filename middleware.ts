/**
 * AI-BOS — Route Protection Middleware
 * Runs on every request. Checks Supabase session.
 * Protected routes → /dashboard/**
 * Public routes   → /login, /auth/callback, /
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase';

// ─── Route Configuration ──────────────────────────────────────────────────────

const PUBLIC_ROUTES = ['/login', '/auth/callback', '/'];
const AUTH_ROUTES   = ['/login'];          // Redirect to dashboard if already logged in
const PROTECTED_PREFIX = '/dashboard';

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, response } = createMiddlewareClient(request);

  // Refresh session — required by @supabase/ssr on every request
  const { data: { session } } = await supabase.auth.getSession();

  const isProtected = pathname.startsWith(PROTECTED_PREFIX);
  const isAuthRoute  = AUTH_ROUTES.some(r => pathname === r);

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

  // 3. Root path → redirect based on auth state
  if (pathname === '/') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return response;
}

// ─── Matcher — apply to all routes except static assets ──────────────────────

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|images|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
