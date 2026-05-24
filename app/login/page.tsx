/**
 * AI-BOS — Login Page
 * Route: /login
 *
 * Design spec:
 * - Full-screen animated mesh gradient background
 * - Floating particles (CSS-only)
 * - Glassmorphism card fades up from below on mount
 * - AI-BOS logo with animated gradient text + glow pulse
 * - "FINANCIAL INTELLIGENCE PLATFORM" in DM Mono, animated letter spacing
 * - White Google sign-in button — full width, smooth hover
 * - Error state: card shakes + red border flash
 */

'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase';

// ─── Google Icon ───────────────────────────────────────────────────────────────

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── Animated Particles ────────────────────────────────────────────────────────

function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 20}s`,
    duration: `${15 + Math.random() * 15}s`,
    size: Math.random() > 0.6 ? 3 : 2,
    opacity: 0.2 + Math.random() * 0.4,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.left,
            bottom: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: `rgba(99, 179, 237, ${p.opacity})`,
            boxShadow: `0 0 ${p.size * 3}px rgba(99, 179, 237, ${p.opacity * 0.6})`,
            animation: `particleFloat ${p.duration} ${p.delay} linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── AI-BOS Logo Mark ──────────────────────────────────────────────────────────

function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="logo-glow flex-shrink-0"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="24" cy="24" r="22" stroke="url(#logoGrad)" strokeWidth="1.5" opacity="0.4" />
      {/* Inner hexagon */}
      <path
        d="M24 8 L37.5 15.5 L37.5 30.5 L24 38 L10.5 30.5 L10.5 15.5 Z"
        stroke="url(#logoGrad)"
        strokeWidth="1.5"
        fill="rgba(96,165,250,0.06)"
      />
      {/* Brain/circuit nodes */}
      <circle cx="24" cy="24" r="3" fill="url(#logoGrad)" />
      <circle cx="16" cy="18" r="2" fill="url(#logoGrad)" opacity="0.7" />
      <circle cx="32" cy="18" r="2" fill="url(#logoGrad)" opacity="0.7" />
      <circle cx="16" cy="30" r="2" fill="url(#logoGrad)" opacity="0.7" />
      <circle cx="32" cy="30" r="2" fill="url(#logoGrad)" opacity="0.7" />
      {/* Connection lines */}
      <line x1="24" y1="24" x2="16" y2="18" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.5" />
      <line x1="24" y1="24" x2="32" y2="18" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.5" />
      <line x1="24" y1="24" x2="16" y2="30" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.5" />
      <line x1="24" y1="24" x2="32" y2="30" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ children, variant }: { children: React.ReactNode; variant: 'error' | 'info' }) {
  const colours = {
    error: 'border-red-500/30 bg-red-500/10 text-red-400',
    info:  'border-blue-500/30 bg-blue-500/10 text-blue-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${colours[variant]}`}
    >
      <span className="text-xs">
        {variant === 'error' ? '⚠' : 'ℹ'}
      </span>
      <span className="font-mono-data">{children}</span>
    </motion.div>
  );
}

// ─── Main Login Component ──────────────────────────────────────────────────────

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [loading, setLoading]         = useState(false);
  const [shaking, setShaking]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // ── Parse error from URL params (after failed OAuth redirect) ────────────
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
      triggerShake();
    }
  }, [searchParams]);

  // ── Trigger shake + red border ────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }, []);

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogleSignIn = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);

    const redirectTo = searchParams.get('redirectTo') ?? '/dashboard';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        queryParams: {
          access_type: 'offline',  // Gets refresh_token
          prompt: 'select_account', // Always show account picker
        },
        scopes: 'email profile',
      },
    });

    if (error) {
      console.error('[AI-BOS Login] OAuth error:', error);
      setErrorMsg(error.message || 'Failed to initiate sign-in. Please try again.');
      setLoading(false);
      triggerShake();
      return;
    }

    // After this, Supabase handles the redirect — we show a brief "Redirecting" state
    setRedirecting(true);
  }, [loading, supabase, searchParams, triggerShake]);

  // ─── Keyboard shortcut: Enter key on the page ────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) handleGoogleSignIn();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGoogleSignIn, loading]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#03060d]">

      {/* ── Animated mesh background ─────────────────────────────────── */}
      <div className="mesh-bg" aria-hidden="true" />

      {/* ── Floating particles ───────────────────────────────────────── */}
      <Particles />

      {/* ── Subtle grid overlay ──────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,179,237,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,179,237,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* ── Corner accents ───────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 w-64 h-64 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse at top left, rgba(59,130,246,0.06) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-96 h-96 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse at bottom right, rgba(6,182,212,0.05) 0%, transparent 70%)',
        }}
      />

      {/* ── Main card ────────────────────────────────────────────────── */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className={`relative z-10 w-full max-w-md mx-4 ${shaking ? 'shake' : ''}`}
        style={{}}
      >
        {/* Glass card */}
        <div
          className="glass relative rounded-[20px] p-8 sm:p-10 card-glow-top overflow-hidden"
          style={{
            borderColor: errorMsg ? 'rgba(239,68,68,0.3)' : undefined,
            transition: 'border-color 0.3s ease',
          }}
        >
          {/* Scanlines for depth */}
          <div className="scanlines absolute inset-0 rounded-[20px] pointer-events-none" aria-hidden="true" />

          {/* ── Logo + wordmark ──────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-4 mb-8">

            {/* Logo mark with animated entrance */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, duration: 0.5, type: 'spring', stiffness: 200 }}
            >
              <LogoMark size={52} />
            </motion.div>

            {/* AI-BOS wordmark */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-center"
            >
              <h1
                className="text-gradient-animated font-outfit text-[2.6rem] leading-none tracking-[-0.03em]"
                style={{ fontWeight: 800 }}
              >
                AI-BOS
              </h1>
            </motion.div>

            {/* Tagline in DM Mono */}
            <motion.p
              initial={{ opacity: 0, letterSpacing: '0.5em' }}
              animate={{ opacity: 1, letterSpacing: '0.18em' }}
              transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
              className="font-mono-data text-[0.6rem] sm:text-[0.65rem] text-[#4a6285] uppercase text-center"
            >
              Financial Intelligence Platform
            </motion.p>
          </div>

          {/* ── Divider ──────────────────────────────────────────────── */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="h-px mb-8"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.25), transparent)',
            }}
          />

          {/* ── Sign-in section ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.45 }}
            className="flex flex-col gap-5"
          >
            {/* Heading */}
            <div className="text-center">
              <h2
                className="text-[#e2eeff] text-xl sm:text-2xl leading-snug"
                style={{ fontWeight: 600 }}
              >
                Sign in to continue
              </h2>
              <p className="text-[#4a6285] text-sm mt-1.5 font-mono-data">
                Your session is protected and encrypted
              </p>
            </div>

            {/* ── Error / status message ─────────────────────────────── */}
            <AnimatePresence>
              {errorMsg && (
                <StatusBadge variant="error">{errorMsg}</StatusBadge>
              )}
              {redirecting && !errorMsg && (
                <StatusBadge variant="info">
                  <span className="flex items-center gap-2">
                    Redirecting to Google
                    <span className="loading-dots flex gap-1">
                      <span />
                      <span />
                      <span />
                    </span>
                  </span>
                </StatusBadge>
              )}
            </AnimatePresence>

            {/* ── Google Sign-in Button ─────────────────────────────── */}
            <motion.button
              onClick={handleGoogleSignIn}
              disabled={loading || redirecting}
              whileHover={(!loading && !redirecting) ? { y: -2 } : {}}
              whileTap={(!loading && !redirecting) ? { scale: 0.98 } : {}}
              className="btn-google relative flex items-center justify-center gap-3 w-full h-[52px] text-[15px] disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Continue with Google"
              style={{ fontWeight: 500 }}
            >
              {loading || redirecting ? (
                <>
                  {/* Custom branded spinner */}
                  <div className="relative w-5 h-5">
                    <div
                      className="absolute inset-0 rounded-full border-2 border-[#03060d]/20"
                    />
                    <div
                      className="absolute inset-0 rounded-full border-2 border-t-[#3b82f6] border-r-transparent border-b-transparent border-l-transparent animate-spin"
                    />
                  </div>
                  <span className="text-[#1a1a2e]">
                    {redirecting ? 'Redirecting…' : 'Connecting…'}
                  </span>
                </>
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <span>Continue with Google</span>
                </>
              )}
            </motion.button>

            {/* ── Keyboard hint ─────────────────────────────────────── */}
            <p
              className="text-center font-mono-data text-[11px] text-[#2d4a70]"
              aria-hidden="true"
            >
              Press{' '}
              <kbd className="px-1.5 py-0.5 rounded border border-[#2d4a70] text-[10px] bg-[#090d1e]">
                Enter
              </kbd>
              {' '}to continue
            </p>
          </motion.div>

          {/* ── Footer ───────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-8 pt-6"
            style={{
              borderTop: '1px solid rgba(99,179,237,0.08)',
            }}
          >
            <p className="text-center font-mono-data text-[11px] text-[#2d4a70] leading-relaxed">
              Powered by AI · Built for Finance
              <br />
              <span className="text-[10px]">
                By continuing you agree to our{' '}
                <a
                  href="/terms"
                  className="text-[#4a6285] hover:text-[#60a5fa] transition-colors underline underline-offset-2"
                >
                  Terms
                </a>
                {' '}and{' '}
                <a
                  href="/privacy"
                  className="text-[#4a6285] hover:text-[#60a5fa] transition-colors underline underline-offset-2"
                >
                  Privacy Policy
                </a>
              </span>
            </p>
          </motion.div>

          {/* ── Inner subtle border top glow ─────────────────────────── */}
          <div
            className="absolute top-0 left-[15%] right-[15%] h-[1px]"
            aria-hidden="true"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.35), transparent)',
            }}
          />
        </div>

        {/* ── External glow behind card ─────────────────────────────────── */}
        <div
          className="absolute -inset-[1px] rounded-[21px] -z-10 opacity-20 blur-xl"
          aria-hidden="true"
          style={{
            background: 'linear-gradient(135deg, #60a5fa, #06b6d4)',
          }}
        />
      </motion.div>

      {/* ── Build / version stamp ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-6 left-0 right-0 flex justify-center"
      >
        <p className="font-mono-data text-[10px] text-[#2d4a70] tracking-wider uppercase">
          AI-BOS v2.0 · Next.js + Supabase
        </p>
      </motion.div>
    </div>
  );
}
