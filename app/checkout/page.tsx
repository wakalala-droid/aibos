'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { TIERS, usdApprox, type Tier } from '@/lib/tiers';
import { initiatePayment, checkPaymentStatus } from '@/lib/api';

// Merchant mobile-money accounts payments are sent to.
const MERCHANT = {
  mtn:    { label: 'MTN Mobile Money', number: '0762561930', ussd: '*115#', bg: '#ffcc00', fg: '#000' },
  airtel: { label: 'Airtel Money',     number: '0973759352', ussd: '*778#', bg: '#e40000', fg: '#fff' },
} as const;

type Network = keyof typeof MERCHANT;

function isTier(v: string | null): v is Tier {
  return v === 'free' || v === 'pro' || v === 'proplus' || v === 'growth';
}

function CheckoutInner() {
  const params = useSearchParams();
  const planParam = params.get('plan');
  const billing = params.get('billing') === 'annual' ? 'annual' : 'monthly';
  const setTier = useStore((s) => s.setTier);

  // Tier is SERVER-authoritative and the client can no longer write it directly
  // (the profiles guard trigger pins tier for self-updates — migration 0010).
  //   • Paid unlocks are granted by the backend when the payment is confirmed
  //     (aibos-api `_grant_tier`); here we just update the local UX cache and let
  //     lib/profile.tsx re-hydrate the real value from Supabase.
  //   • Free is set through the service-role route /api/checkout/select-free.
  const cacheTier = useCallback((t: Tier) => setTier(t), [setTier]);

  const selectFree = useCallback(async () => {
    try {
      await fetch('/api/checkout/select-free', { method: 'POST' });
    } catch {
      /* non-fatal — profile will still reflect the server value on next load */
    }
    setTier('free');
  }, [setTier]);

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
          // The backend already granted the tier server-side on confirmation;
          // reflect it locally for instant UX (authoritative value re-hydrates).
          if (isTier(planParam) && planParam !== 'free') cacheTier(planParam);
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
  }, [status, reference, planParam, cacheTier]);

  const startPayment = async () => {
    setError('');
    setStatus('pending');
    try {
      const r = await initiatePayment({
        network,
        plan: planParam as 'pro' | 'proplus' | 'growth',
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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 12px' }}>
          {planParam === 'free' ? 'You’re on the Free plan' : 'Choose a plan first'}
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.55 }}>
          {planParam === 'free'
            ? 'Financial engine, last 30 days, full P&L and cashflow — no payment needed.'
            : 'Head back to pricing to pick Pro or Growth.'}
        </p>
        {planParam === 'free' && (
          <button type="button" onClick={() => void selectFree()} style={btnPrimary}>Confirm Free plan</button>
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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 10px' }}>
          Welcome to {meta.name}
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.55 }}>
          Your plan is active. Forecast, anomaly detection, the AI CFO and your scheduled brief are unlocked.
        </p>
        <Link href="/dashboard" style={btnPrimary}>Go to dashboard →</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 64px' }}>
      <Link href="/pricing" style={{ ...linkMuted, display: 'inline-block', marginBottom: 16 }}>← Back to pricing</Link>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 20px', letterSpacing: '-0.02em' }}>
        Checkout
      </h1>

      {/* Order summary — full price up front, no drip pricing. */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Order summary
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>
            AI-BOS {meta.name}
          </span>
          <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-1)' }}>
            K{amount.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{meta.tagline}</span>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            {periodLabel} · ≈ ${usdApprox(amount)}
          </span>
        </div>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '12px 0 0', lineHeight: 1.5 }}>
          Total today: <strong style={{ color: 'var(--text-2)' }}>K{amount.toLocaleString()}</strong>. No setup fees, no add-ons. Cancel anytime.
        </p>
      </div>

      {/* Network selection */}
      <fieldset className="section-card" style={{ marginBottom: 16, border: '1px solid var(--border)' }}>
        <legend style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 6px' }}>
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
                <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: info.fg, background: info.bg, padding: '4px 8px', borderRadius: 6 }}>
                  {net === 'mtn' ? 'MTN' : 'Airtel'}
                </span>
                <span style={{ fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-2)' }}>
                  {info.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Payment instructions for the chosen network */}
        <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
            Enter your {m.label} number below and tap <strong>Pay</strong>. You’ll get a prompt
            on your phone to approve <strong>K{amount.toLocaleString()}</strong>.
          </p>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '8px 0 0' }}>
            Prefer manual? Dial {m.ussd} and send to {m.number} (AI-BOS · {m.label}).
          </p>
        </div>

        {/* Payer's own number — the line that receives the approval prompt */}
        <div style={{ marginTop: 14 }}>
          <label htmlFor="payer-phone" style={{ display: 'block', fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
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
              color: 'var(--text-1)', fontSize: 'var(--fs-body)',
              outline: 'none',
            }}
          />
        </div>
      </fieldset>

      {status === 'pending' && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, marginBottom: 12, background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)' }}>
          <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--cyan)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', margin: 0, lineHeight: 1.45 }}>
            Check your phone — approve the {m.label} prompt to confirm K{amount.toLocaleString()}.
          </p>
        </div>
      )}

      {status === 'failed' && error && (
        <p role="alert" style={{ fontSize: 'var(--fs-data)', color: 'var(--crit)', margin: '0 0 12px', lineHeight: 1.5 }}>
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

      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5 }}>
        You can cancel anytime from settings. Your financial data stays exportable on every plan.
      </p>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-block', textAlign: 'center',
  fontSize: 'var(--fs-body)', fontWeight: 700,
  color: '#fff', background: 'var(--cyan)', padding: '13px 22px',
  borderRadius: 10, border: 'none', textDecoration: 'none',
};

const linkMuted: React.CSSProperties = {
  fontSize: 'var(--fs-label)',
  color: 'var(--text-3)', textDecoration: 'none',
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading checkout…</div>}>
      <CheckoutInner />
    </Suspense>
  );
}
