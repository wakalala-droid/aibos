'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
import { NoticeArt } from '@/components/kit';
import NavyPage from '@/components/brand/NavyPage';
import '../navy.css';

// ─── Google Icon ───────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Logo ──────────────────────────────────────────────────────
// The navy page, so the white mark and wordmark, as on the website's menu.

function Logo() {
  return (
    <div className="login-logo">
      <Image src="/brand/aibos-mark-white-glyph.png" alt="" aria-hidden width={34} height={34} style={{ width: 34, height: 34, objectFit: 'contain' }} priority />
      <Image src="/brand/aibos-wordmark-white.png" alt="AIBOS" width={92} height={24} style={{ width: 92, height: 'auto', objectFit: 'contain' }} priority />
    </div>
  );
}

// ─── Inner login form — uses useSearchParams so must be in Suspense ─

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [loading, setLoading]         = useState(false);
  const [shaking, setShaking]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const urlError = searchParams.get('error');
    const urlDesc  = searchParams.get('error_description');
    if (urlError) {
      const messages: Record<string, string> = {
        no_code:                'Authentication code missing. Please try again.',
        session_exchange_failed: 'Could not complete sign-in. Please try again.',
        access_denied:          'Access denied. Please use an authorised account.',
      };
      setErrorMsg(messages[urlError] ?? urlDesc ?? 'Sign-in failed. Please try again.');
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }
  }, [searchParams]);

  const handleGoogleSignIn = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);

    const redirectTo = searchParams.get('redirectTo') ?? '/dashboard';
    // Referral code rides the whole OAuth round-trip so the auth callback can
    // stamp referred_by on FIRST profile provision only (referral loop).
    const ref = searchParams.get('ref');
    const callbackUrl =
      `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}` +
      (ref ? `&ref=${encodeURIComponent(ref)}` : '');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
        scopes: 'email profile',
      },
    });

    if (error) {
      setErrorMsg(error.message || 'Failed to initiate sign-in. Please try again.');
      setLoading(false);
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }
    setRedirecting(true);
  }, [loading, supabase, searchParams]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) handleGoogleSignIn();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleGoogleSignIn, loading]);

  // UI/UX audit 2026-10 A19 made sign-in a still page with one heading, big
  // words and a 52px Google button. 10 Oct 2026: the same, in the website's
  // navy (owner: "do the same navy treatment on the app login page"), on the
  // kit's notice with the splash art strip, like the What's new screen.
  return (
    <main className={`notice notice-floating login-card${errorMsg ? ' is-error' : ''}${shaking ? ' shake' : ''}`}>
      <NoticeArt theme="dark" />
      <div className="login-body">
        <h1 className="login-title">Sign in to AIBOS</h1>
        <p className="login-text">Use your Google account. There is no password to remember.</p>

        {errorMsg && <p role="alert" className="login-error">{errorMsg}</p>}
        {redirecting && <p role="status" className="login-status">Taking you to Google…</p>}

        <button
          type="button"
          className="login-google"
          onClick={handleGoogleSignIn}
          disabled={loading || redirecting}
          aria-label="Continue with Google"
        >
          {loading || redirecting ? <span aria-hidden className="login-spin" /> : <GoogleIcon />}
          <span>{redirecting ? 'Redirecting…' : loading ? 'Connecting…' : 'Continue with Google'}</span>
        </button>

        <p className="login-legal">
          By continuing you agree to our{' '}
          <a href="/terms" className="tap-link">Terms</a>
          {' '}and{' '}
          <a href="/privacy" className="tap-link">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

// ─── Page: wraps LoginForm in Suspense ─────────────────────────────

export default function LoginPage() {
  return (
    <div data-navy data-theme="dark" className="login-page">
      <NavyPage />
      <Logo />
      {/* A plain navy card while the form loads, the same size, so nothing jumps. */}
      <Suspense fallback={<div aria-busy="true" className="notice login-card" style={{ minHeight: 420 }} />}>
        <LoginForm />
      </Suspense>
      <p className="login-foot">Artificial Intelligence Business Operating System</p>
    </div>
  );
}
