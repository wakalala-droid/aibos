'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
import { BrandLockup } from '@/components/brand/BootSplash';

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
// Light page, so the dark bare mark (the marketing nav's mark), no glow.

function LogoMark() {
  return (
    <Image
      src="/brand/aibos-mark.png"
      alt=""
      aria-hidden
      width={72}
      height={72}
      style={{ width: 72, height: 'auto', objectFit: 'contain' }}
      priority
    />
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

  // UI/UX audit 2026-10 A19: the sign-in used to be a small dark glass card on
  // a looping starfield, with most words at 12px and the legal line at 2.16:1,
  // right after a cream marketing site. Now: the site's light paper, a still
  // page, one heading, 18px words and a 52px Google button.
  return (
    <main
      className={`login-card ${shaking ? 'shake' : ''}`}
      style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 460, margin: '0 16px',
        background: '#fffdf9', border: `1px solid ${errorMsg ? '#b91c1c' : 'rgba(28,25,23,0.14)'}`,
        borderRadius: 16, padding: '40px 32px 32px',
        boxShadow: '0 1px 2px rgba(28,25,23,0.05), 0 12px 32px rgba(28,25,23,0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <LogoMark />
      </div>

      <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: '#15110f', textAlign: 'center', margin: 0, letterSpacing: '-0.02em' }}>
        Sign in to AIBOS
      </h1>
      <p style={{ fontSize: 'var(--fs-body)', color: '#4a443e', textAlign: 'center', margin: '8px 0 28px', lineHeight: 1.6 }}>
        Use your Google account. There is no password to remember.
      </p>

      {errorMsg && (
        <p role="alert" style={{ fontSize: 'var(--fs-body)', color: '#b91c1c', background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.3)', borderRadius: 10, padding: '12px 14px', margin: '0 0 16px', lineHeight: 1.5 }}>
          {errorMsg}
        </p>
      )}
      {redirecting && (
        <p role="status" style={{ fontSize: 'var(--fs-body)', color: '#075985', margin: '0 0 16px', textAlign: 'center' }}>
          Taking you to Google…
        </p>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading || redirecting}
        aria-label="Continue with Google"
        style={{
          width: '100%', minHeight: 56, borderRadius: 10, border: '1px solid rgba(28,25,23,0.24)',
          background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontSize: 'var(--fs-body)', fontWeight: 600, color: '#15110f',
          cursor: loading || redirecting ? 'default' : 'pointer',
          boxShadow: '0 1px 2px rgba(28,25,23,0.06)',
        }}
      >
        {loading || redirecting ? (
          <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.15)', borderTop: '2px solid #075985', animation: 'spin 0.8s linear infinite' }} />
        ) : (
          <GoogleIcon />
        )}
        <span>{redirecting ? 'Redirecting…' : loading ? 'Connecting…' : 'Continue with Google'}</span>
      </button>

      <p style={{ fontSize: 'var(--fs-body)', color: '#4a443e', textAlign: 'center', margin: '24px 0 0', lineHeight: 1.6 }}>
        By continuing you agree to our{' '}
        <a href="/terms" className="tap-link" style={{ color: '#075985', textDecoration: 'underline', textUnderlineOffset: 3 }}>Terms</a>
        {' '}and{' '}
        <a href="/privacy" className="tap-link" style={{ color: '#075985', textDecoration: 'underline', textUnderlineOffset: 3 }}>Privacy Policy</a>.
      </p>
    </main>
  );
}

// ─── Page: wraps LoginForm in Suspense ─────────────────────────────

export default function LoginPage() {
  return (
    <div
      data-theme="light"
      style={{
        position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24, padding: '32px 0',
        background: '#f4f3ef', color: '#15110f',
      }}
    >
      <Suspense fallback={<BrandLockup markSize={150} />}>
        <LoginForm />
      </Suspense>
      <p style={{ fontSize: 'var(--fs-caps)', color: '#5d564f', letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', padding: '0 16px', margin: 0 }}>
        Artificial Intelligence Business Operating System
      </p>
    </div>
  );
}
