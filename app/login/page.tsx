'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';

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

// ─── Particles ─────────────────────────────────────────────────────

function Particles() {
  const items = [
    { left: '8%',  dur: '18s', delay: '0s',  size: 2 },
    { left: '22%', dur: '22s', delay: '3s',  size: 3 },
    { left: '45%', dur: '16s', delay: '7s',  size: 2 },
    { left: '68%', dur: '20s', delay: '1s',  size: 2 },
    { left: '85%', dur: '24s', delay: '5s',  size: 3 },
    { left: '32%', dur: '19s', delay: '11s', size: 2 },
    { left: '55%', dur: '21s', delay: '9s',  size: 2 },
    { left: '75%', dur: '17s', delay: '4s',  size: 3 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: p.left, bottom: '-10px',
            width: p.size, height: p.size,
            background: 'rgba(99,179,237,0.45)',
            boxShadow: `0 0 ${p.size * 3}px rgba(99,179,237,0.3)`,
            animation: `particleFloat ${p.dur} ${p.delay} linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Logo ──────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <Image
      src="/brand/aibos-mark-white.png"
      alt="AIBOS — Artificial Intelligence Business Operating System"
      width={240}
      height={178}
      style={{ width: 240, height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 18px rgba(96,165,250,0.4))' }}
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
        no_code:                 'Authentication code missing. Please try again.',
        session_exchange_failed: 'Could not complete sign-in. Please try again.',
        access_denied:           'Access denied. Please use an authorised account.',
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      className={`relative z-10 w-full max-w-md mx-4 ${shaking ? 'shake' : ''}`}
    >
      {/* Glass card */}
      <div
        className="relative rounded-[20px] p-8 sm:p-10 overflow-hidden"
        style={{
          background:     'rgba(9,13,30,0.78)',
          backdropFilter: 'blur(20px)',
          border:         `1px solid ${errorMsg ? 'rgba(239,68,68,0.3)' : 'rgba(99,179,237,0.15)'}`,
          boxShadow:      '0 0 0 1px rgba(99,179,237,0.08), 0 16px 48px rgba(0,0,0,0.5)',
          transition:     'border-color 0.3s ease',
        }}
      >
        {/* Top glow line */}
        <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(99,179,237,0.4),transparent)' }} />
        {/* Back glow */}
        <div style={{ position: 'absolute', inset: -1, borderRadius: 21, zIndex: -1, background: 'linear-gradient(135deg,#60a5fa,#06b6d4)', opacity: 0.12, filter: 'blur(8px)' }} />

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.5, type: 'spring', stiffness: 200 }}>
            <LogoMark />
          </motion.div>
        </div>

        {/* Divider */}
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.4 }} style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(99,179,237,0.25),transparent)', marginBottom: 28 }} />

        {/* Heading */}
        <div className="text-center mb-5">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#e2eeff', margin: 0 }}>Sign in to continue</h2>
          <p style={{ fontSize: 'var(--fs-label)', color: '#4a6285', marginTop: 4 }}>Your session is protected and encrypted</p>
        </div>

        {/* Error */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 16, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)' }}
            >
              <span style={{ fontSize: 'var(--fs-label)', color: '#ef4444' }}>⚠ {errorMsg}</span>
            </motion.div>
          )}
          {redirecting && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 16, borderRadius: 8, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.1)' }}
            >
              <span style={{ fontSize: 'var(--fs-label)', color: '#60a5fa' }}>Redirecting to Google…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google button */}
        <motion.button
          onClick={handleGoogleSignIn}
          disabled={loading || redirecting}
          whileHover={(!loading && !redirecting) ? { y: -2 } : {}}
          whileTap={(!loading && !redirecting) ? { scale: 0.98 } : {}}
          style={{ width: '100%', height: 52, borderRadius: 11, border: '1px solid rgba(0,0,0,0.06)', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 'var(--fs-body)', fontWeight: 500, color: '#1a1a2e', cursor: loading || redirecting ? 'not-allowed' : 'pointer', opacity: loading || redirecting ? 0.65 : 1, transition: 'box-shadow 0.15s ease' }}
          aria-label="Continue with Google"
        >
          {loading || redirecting ? (
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.15)', borderTop: '2px solid #3b82f6', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <GoogleIcon />
          )}
          <span>{redirecting ? 'Redirecting…' : loading ? 'Connecting…' : 'Continue with Google'}</span>
        </motion.button>

        {/* Keyboard hint */}
        <p style={{ textAlign: 'center', fontSize: 'var(--fs-label)', color: '#2d4a70', marginTop: 12 }}>
          Press <kbd style={{ padding: '2px 6px', border: '1px solid #2d4a70', borderRadius: 4, fontSize: 'var(--fs-label)', background: '#090d1e', color: '#4a6285' }}>Enter</kbd> to continue
        </p>

        {/* Footer */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(99,179,237,0.08)', textAlign: 'center', fontSize: 'var(--fs-label)', color: '#2d4a70', lineHeight: 1.8 }}>
          Powered by AI · Built for Finance
          <br />
          <span style={{ fontSize: 'var(--fs-label)' }}>
            By continuing you agree to our{' '}
            <a href="/terms"   style={{ color: '#4a6285', textDecoration: 'underline', textUnderlineOffset: 2 }}>Terms</a>
            {' '}and{' '}
            <a href="/privacy" style={{ color: '#4a6285', textDecoration: 'underline', textUnderlineOffset: 2 }}>Privacy Policy</a>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page — wraps LoginForm in Suspense ────────────────────────────

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#03060d]">
      <div className="mesh-bg" aria-hidden="true" />
      <Particles />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ backgroundImage: 'linear-gradient(rgba(99,179,237,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,179,237,0.03) 1px,transparent 1px)', backgroundSize: '64px 64px' }}
      />
      <Suspense fallback={
        <div style={{ color: '#4a6285', fontSize: 'var(--fs-data)' }}>Loading…</div>
      }>
        <LoginForm />
      </Suspense>
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <p style={{ fontSize: 'var(--fs-label)', color: '#2d4a70', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          AIBOS v2.0 · Next.js + Supabase
        </p>
      </div>
    </div>
  );
}
