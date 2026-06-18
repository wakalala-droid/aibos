'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { TIERS, usdApprox, type Tier } from '@/lib/tiers';
import { initiatePayment, checkPaymentStatus } from '@/lib/api';
import { createClient } from '@/lib/supabase';

// Merchant mobile-money accounts payments are sent to.
const MERCHANT = {
  mtn:    { label: 'MTN Mobile Money', number: '0762561930', ussd: '*115#', bg: '#ffcc00', fg: '#000' },
  airtel: { label: 'Airtel Money',     number: '0973759352', ussd: '*778#', bg: '#e40000', fg: '#fff' },
} as const;

type Network = keyof typeof MERCHANT;

function isTier(v: string | null): v is Tier {
  return v === 'free' || v === 'pro' || v === 'growth';
}

function CheckoutInner() {
  const params = useSearchParams();
  const planParam = params.get('plan');
  const billing = params.get('billing') === 'annual' ? 'annual' : 'monthly';
  const setTier = useStore((s) => s.setTier);

  // Tier is server-authoritative: cache it locally AND persist to the user's
  // Supabase row so the unlock survives reloads and follows them across devices.
  const persistTier = useCallback(
    async (t: Tier, source: 'payment' | 'self') => {
      setTier(t);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ tier: t, tier_source: source, tier_granted_at: new Date().toISOString() })
            .eq('id', user.id);
        }
      } catch {
        /* non-fatal — the local cache is already set */
      }
    },
    [setTier]
  );

  const [network, setNetwork] = useState<Network>('mtn');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'failed'>('idle');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll the collection status until it resolves (or times out ~60s).
  useEffect(() => {
    if (status !== 'pending' || !reference) return;
    let active = true;
    let tries = 0;
    const tick = async () => {
      if (!active) return;
      tries += 1;
      try {
        const r = await checkPaymentStatus(reference);
        if (!active) return;
        if (r.status === 'successful') {
          if (isTier(planParam) && planParam !== 'free') void persistTier(planParam, 'payment');
          setStatus('done');
          return;
        }
        if (r.status === 'failed') {
          setStatus('failed');
          setError('The payment was declined or cancelled. No money was taken — you can try again.');
          return;
        }
      } catch { /* keep polling */ }
      if (tries >= 24) {
        setStatus('failed');
        setError('We haven’t confirmed your payment yet. If you approved it, give it a moment and try again, or contact support.');
        return;
      }
      pollRef.current = setTimeout(tick, 2500);
    };
    pollRef.current = setTimeout(tick, 2500);
    return () => { active = false; if (pollRef.current) clearTimeout(pollRef.current); };
  }, [status, reference, planParam, persistTier]);

  const startPayment = async () => {
    setError('');
    setStatus('pending');
    try {
      const r = await initiatePayment({
        network,
        plan: planParam as 'pro' | 'growth',
        billing,
        payer_phone: phone,
      });
      setReference(r.reference);
      // The polling effect takes over from here.
    } catch (e) {
      setStatus('failed');
      setError((e as Error).message || 'Could not start the payment. Please try again.');
    }
  };

  if (!isTier(planParam) || planParam === 'free') {
    // Free needs no payment — apply immediately if requested.
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 12px' }}>
          {planParam === 'free' ? 'You’re on the Free plan' : 'Choose a plan first'}
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.55 }}>
          {planParam === 'free'
            ? 'Engine 1, last 30 days, full P&L and cashflow — no payment needed.'
            : 'Head back to pricing to pick Pro or Growth.'}
        </p>
        {planParam === 'free' && (
          <button type="button" onClick={() => void persistTier('free', 'self')} style={btnPrimary}>Confirm Free plan</button>
        )}
        <div style={{ marginTop: 16 }}>
          <Link href="/pricing" style={linkMuted}>← Back to pricing</Link>
        </div>
      </div>
    );
  }

  const meta = TIERS[planParam];
  const amount = billing === 'annual' ? meta.priceAnnual : meta.priceMonthly;
  const periodLabel = billing === 'annual' ? 'per year' : 'per month';
  const m = MERCHANT[network];

  if (status === 'done') {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="var(--good)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 10px' }}>
          Welcome to {meta.name}
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.55 }}>
          Your plan is active. Forecast, anomaly detection, the AI CFO and your scheduled brief are unlocked.
        </p>
        <Link href="/dashboard" style={btnPrimary}>Go to dashboard →</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 64px' }}>
      <Link href="/pricing" style={{ ...linkMuted, display: 'inline-block', marginBottom: 16 }}>← Back to pricing</Link>

      <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 20px', letterSpacing: '-0.02em' }}>
        Checkout
      </h1>

      {/* Order summary — full price up front, no drip pricing. */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Order summary
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-1)' }}>
            AI-BOS {meta.name}
          </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-1)' }}>
            K{amount.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-3)' }}>{meta.tagline}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-3)' }}>
            {periodLabel} · ≈ ${usdApprox(amount)}
          </span>
        </div>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: 'var(--text-4)', margin: '12px 0 0', lineHeight: 1.5 }}>
          Total today: <strong style={{ color: 'var(--text-2)' }}>K{amount.toLocaleString()}</strong>. No setup fees, no add-ons. Cancel anytime.
        </p>
      </div>

      {/* Network selection */}
      <fieldset className="section-card" style={{ marginBottom: 16, border: '1px solid var(--border)' }}>
        <legend style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 6px' }}>
          Pay with mobile money
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
          {(Object.keys(MERCHANT) as Network[]).map((net) => {
            const info = MERCHANT[net];
            const active = network === net;
            return (
              <button
                key={net}
                type="button"
                aria-pressed={active}
                onClick={() => setNetwork(net)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                  border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-md)'}`,
                  background: active ? 'color-mix(in srgb, var(--cyan) 8%, transparent)' : 'var(--bg-card)',
                }}
              >
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 700, color: info.fg, background: info.bg, padding: '4px 8px', borderRadius: 6 }}>
                  {net === 'mtn' ? 'MTN' : 'Airtel'}
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)' }}>
                  {info.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Payment instructions for the chosen network */}
        <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
            Enter your {m.label} number below and tap <strong>Pay</strong>. You’ll get a prompt
            on your phone to approve <strong>K{amount.toLocaleString()}</strong>.
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)', margin: '8px 0 0' }}>
            Prefer manual? Dial {m.ussd} and send to {m.number} (AI-BOS · {m.label}).
          </p>
        </div>

        {/* Payer's own number — the line that receives the approval prompt */}
        <div style={{ marginTop: 14 }}>
          <label htmlFor="payer-phone" style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
            Your {m.label} number <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(required)</span>
          </label>
          <input
            id="payer-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 097 123 4567"
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 10,
              border: '1px solid var(--border-md)', background: 'var(--bg-input)',
              color: 'var(--text-1)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>
      </fieldset>

      {status === 'pending' && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, marginBottom: 12, background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)' }}>
          <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--cyan)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.45 }}>
            Check your phone — approve the {m.label} prompt to confirm K{amount.toLocaleString()}.
          </p>
        </div>
      )}

      {status === 'failed' && error && (
        <p role="alert" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', color: 'var(--crit)', margin: '0 0 12px', lineHeight: 1.5 }}>
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={phone.trim().length < 9 || status === 'pending'}
        onClick={startPayment}
        style={{
          ...btnPrimary,
          width: '100%',
          opacity: phone.trim().length < 9 || status === 'pending' ? 0.55 : 1,
          cursor: phone.trim().length < 9 || status === 'pending' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'pending'
          ? 'Waiting for confirmation…'
          : status === 'failed'
          ? 'Try again'
          : `Pay K${amount.toLocaleString()} with ${m.label}`}
      </button>

      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--text-4)', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5 }}>
        You can cancel anytime from settings. Your financial data stays exportable on every plan.
      </p>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-block', textAlign: 'center',
  fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', fontWeight: 700,
  color: '#fff', background: 'var(--cyan)', padding: '13px 22px',
  borderRadius: 10, border: 'none', textDecoration: 'none',
};

const linkMuted: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem',
  color: 'var(--text-3)', textDecoration: 'none',
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif' }}>Loading checkout…</div>}>
      <CheckoutInner />
    </Suspense>
  );
}
