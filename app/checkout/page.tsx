'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { TIERS, usdApprox, type Tier } from '@/lib/tiers';

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

  const [network, setNetwork] = useState<Network>('mtn');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'done'>('idle');

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
          <button type="button" onClick={() => setTier('free')} style={btnPrimary}>Confirm Free plan</button>
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
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--text-2)', margin: '0 0 8px', lineHeight: 1.5 }}>
            Dial <strong>{m.ussd}</strong> on your {m.label} line and send{' '}
            <strong>K{amount.toLocaleString()}</strong> to:
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.05rem', fontWeight: 600, color: 'var(--cyan)', margin: 0, letterSpacing: '0.04em' }}>
            {m.number}
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)', margin: '6px 0 0' }}>
            AI-BOS · {m.label}
          </p>
        </div>

        {/* Payer's own number — for reconciliation */}
        <div style={{ marginTop: 14 }}>
          <label htmlFor="payer-phone" style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
            The number you paid from <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(required)</span>
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

      <button
        type="button"
        disabled={phone.trim().length < 9 || status === 'pending'}
        onClick={() => {
          setStatus('pending');
          // Payment-gateway integration is scaffolded: in production this hands
          // off to the MTN / Airtel collections API and confirms via callback.
          // Here we simulate the confirmation and apply the tier.
          setTimeout(() => { setTier(planParam); setStatus('done'); }, 1200);
        }}
        style={{
          ...btnPrimary,
          width: '100%',
          opacity: phone.trim().length < 9 || status === 'pending' ? 0.55 : 1,
          cursor: phone.trim().length < 9 || status === 'pending' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'pending' ? 'Confirming payment…' : `I’ve paid K${amount.toLocaleString()} — activate ${meta.name}`}
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
