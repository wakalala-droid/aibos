'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { TIERS, TIER_ORDER, usdApprox, type Tier } from '@/lib/tiers';

type Billing = 'monthly' | 'annual';

function Check({ colour }: { colour: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
      <path d="M20 6L9 17l-5-5" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function priceLabel(tier: Tier, billing: Billing): { big: string; small: string } {
  const meta = TIERS[tier];
  if (meta.priceMonthly === 0) return { big: 'Free', small: 'forever' };
  if (billing === 'annual') {
    return { big: `K${meta.priceAnnual.toLocaleString()}`, small: `/year · ≈ $${usdApprox(meta.priceAnnual)}` };
  }
  return { big: `K${meta.priceMonthly.toLocaleString()}`, small: `/month · ≈ $${usdApprox(meta.priceMonthly)}` };
}

export default function PricingPage() {
  const currentTier = useStore((s) => s.tier);
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px 64px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>
          Pricing · Priced in Kwacha
        </p>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
          One CFO for your business. Pay in ZMW.
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.92rem', color: 'var(--text-3)', margin: '0 auto', maxWidth: 560, lineHeight: 1.55 }}>
          Start free on your own numbers. Upgrade when the value is obvious — never before.
        </p>
      </div>

      {/* Billing toggle — monthly is the default; annual is opt-in, never pre-selected. */}
      <div role="group" aria-label="Billing period" style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '24px 0 32px' }}>
        {(['monthly', 'annual'] as Billing[]).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={billing === b}
            onClick={() => setBilling(b)}
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 600,
              padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${billing === b ? 'var(--cyan)' : 'var(--border-md)'}`,
              background: billing === b ? 'color-mix(in srgb, var(--cyan) 12%, transparent)' : 'var(--bg-card)',
              color: billing === b ? 'var(--cyan)' : 'var(--text-2)',
            }}
          >
            {b === 'monthly' ? 'Monthly' : 'Annual'}
            {b === 'annual' && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', marginLeft: 8, color: 'var(--good)' }}>
                2 months free
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, width: '100%' }}>
        {TIER_ORDER.map((tier, i) => {
            const meta = TIERS[tier];
            const isCurrent = currentTier === tier;
            const popular = tier === 'pro';
            const { big, small } = priceLabel(tier, billing);

            return (
              <motion.div
                key={tier}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
                className="section-card"
                style={{
                  display: 'flex', flexDirection: 'column',
                  borderColor: popular ? 'color-mix(in srgb, var(--cyan) 40%, var(--border))' : 'var(--border)',
                  boxShadow: popular ? 'var(--shadow-lg)' : 'var(--shadow-card)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.1rem', fontWeight: 800, color: meta.accent, margin: 0 }}>
                    {meta.name}
                  </h2>
                  {popular && (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)', padding: '2px 8px', borderRadius: 6 }}>
                      MOST POPULAR
                    </span>
                  )}
                  {isCurrent && !popular && (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-3)', border: '1px solid var(--border-md)', padding: '2px 8px', borderRadius: 6 }}>
                      CURRENT
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-3)', margin: '0 0 16px' }}>
                  {meta.tagline}
                </p>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 18 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
                    {big}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-4)' }}>
                    {small}
                  </span>
                </div>

                <ul style={{ listStyle: 'none', margin: '0 0 20px', padding: 0, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  {meta.inclusions.map((inc) => (
                    <li key={inc} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <Check colour={meta.accent} />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.45 }}>
                        {inc}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <span style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-3)', padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-badge)' }}>
                    Your current plan
                  </span>
                ) : tier === 'free' ? (
                  <Link href="/checkout?plan=free" style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-card)', textDecoration: 'none' }}>
                    Switch to Free
                  </Link>
                ) : (
                  <Link
                    href={`/checkout?plan=${tier}&billing=${billing}`}
                    style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 700, color: '#fff', padding: '12px 16px', borderRadius: 10, background: meta.accent, textDecoration: 'none' }}
                  >
                    Choose {meta.name}
                  </Link>
                )}
              </motion.div>
            );
          })}
      </div>

      {/* Mobile money — first-class, not an afterthought. */}
      <div className="section-card" style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>
            Pay with Mobile Money
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-3)', margin: 0 }}>
            MTN Mobile Money &amp; Airtel Money accepted — no card required.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 700, color: '#000', background: '#ffcc00', padding: '8px 14px', borderRadius: 8 }}>
            MTN MoMo
          </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 700, color: '#fff', background: '#e40000', padding: '8px 14px', borderRadius: 8 }}>
            Airtel Money
          </span>
        </div>
      </div>

      {/* Trust signals — the explicit anti-dark-pattern guarantees. */}
      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {[
          ['Cancel anytime', 'The cancel button is never hidden. Stop whenever you like, no phone call required.'],
          ['Your data is yours', 'Export your full financial history on any plan — including after you cancel.'],
          ['No surprise fees', 'The price you see is the price you pay. No drip pricing, no pre-ticked add-ons.'],
          ['Fair price changes', 'We give advance notice before any plan or price change. No silent increases.'],
        ].map(([t, d]) => (
          <div key={t} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>{t}</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
