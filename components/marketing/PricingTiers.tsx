'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { TIERS, TIER_ORDER, usdApprox, type Tier } from '@/lib/tiers';

type Billing = 'monthly' | 'annual';

function priceLabel(tier: Tier, billing: Billing): { big: string; small: string } {
  const meta = TIERS[tier];
  if (meta.priceMonthly === 0) return { big: 'Free', small: 'forever' };
  if (billing === 'annual') {
    return { big: `K${meta.priceAnnual.toLocaleString()}`, small: `/year · ≈ $${usdApprox(meta.priceAnnual)}` };
  }
  return { big: `K${meta.priceMonthly.toLocaleString()}`, small: `/month · ≈ $${usdApprox(meta.priceMonthly)}` };
}

function Check({ colour }: { colour: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 3 }}>
      <path d="M20 6L9 17l-5-5" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PricingTiers() {
  const reduce = useReducedMotion();
  const currentTier = useStore((s) => s.tier);
  const { isAuthenticated } = useAuth();
  const [billing, setBilling] = useState<Billing>('monthly');

  // CTA target for each tier. Logged-out visitors start free; a paid choice
  // routes them through sign-in to checkout for that plan (self-serve, no
  // contact-sales gate — conversion_psychology.md). Logged-in users go straight
  // to checkout, or see their current plan.
  function cta(tier: Tier): { label: string; href: string; primary: boolean; disabled?: boolean } {
    if (isAuthenticated && currentTier === tier) {
      return { label: 'Your current plan', href: '#', primary: false, disabled: true };
    }
    if (tier === 'free') {
      return isAuthenticated
        ? { label: 'Switch to Free', href: '/checkout?plan=free', primary: false }
        : { label: 'Start free', href: '/login', primary: tier === 'free' };
    }
    const checkout = `/checkout?plan=${tier}&billing=${billing}`;
    if (isAuthenticated) {
      return { label: `Choose ${TIERS[tier].name}`, href: checkout, primary: tier === 'pro' };
    }
    return { label: `Start with ${TIERS[tier].name}`, href: `/login?redirectTo=${encodeURIComponent(checkout)}`, primary: tier === 'pro' };
  }

  return (
    <div>
      {/* Billing toggle — monthly is the default; annual is opt-in, never pre-selected. */}
      <div role="group" aria-label="Billing period" style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 36 }}>
        {(['monthly', 'annual'] as Billing[]).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={billing === b}
            onClick={() => setBilling(b)}
            style={{
              fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 600,
              padding: '9px 18px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${billing === b ? 'var(--cyan)' : 'var(--border-md)'}`,
              background: billing === b ? 'var(--cyan-dim)' : 'var(--bg-card)',
              color: billing === b ? 'var(--cyan)' : 'var(--text-2)',
            }}
          >
            {b === 'monthly' ? 'Monthly' : 'Annual'}
            {b === 'annual' && (
              <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', marginLeft: 8, color: 'var(--good)' }}>
                2 months free
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))', gap: 18 }}>
        {TIER_ORDER.map((tier, i) => {
          const meta = TIERS[tier];
          const popular = tier === 'pro';
          const { big, small } = priceLabel(tier, billing);
          const action = cta(tier);

          return (
            <motion.div
              key={tier}
              className="mkt-card"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
              style={{
                display: 'flex', flexDirection: 'column',
                borderColor: popular ? 'color-mix(in srgb, var(--cyan) 45%, var(--border-md))' : 'var(--border-md)',
                boxShadow: popular ? 'var(--shadow-lg)' : 'var(--shadow-card)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, minHeight: 26 }}>
                <h3 style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.15rem', fontWeight: 800, color: meta.accent, margin: 0 }}>
                  {meta.name}
                </h3>
                {popular && (
                  <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)', padding: '3px 9px', borderRadius: 999 }}>
                    MOST POPULAR
                  </span>
                )}
              </div>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-3)', margin: '0 0 18px' }}>
                {meta.tagline}
              </p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
                <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
                  {big}
                </span>
                <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.7rem', color: 'var(--text-4)' }}>
                  {small}
                </span>
              </div>

              <ul style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {meta.inclusions.map((inc) => (
                  <li key={inc} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <Check colour={meta.accent} />
                    <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.45 }}>
                      {inc}
                    </span>
                  </li>
                ))}
              </ul>

              {action.disabled ? (
                <span style={{ textAlign: 'center', fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-3)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-md)', background: 'var(--bg-badge)' }}>
                  {action.label}
                </span>
              ) : (
                <Link href={action.href} className={`mkt-btn ${action.primary ? 'mkt-btn-primary' : 'mkt-btn-secondary'}`} style={{ justifyContent: 'center' }}>
                  {action.label}
                </Link>
              )}

              {tier === 'free' && (
                <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.62rem', color: 'var(--text-4)', margin: '12px 0 0', textAlign: 'center' }}>
                  Locked features stay visible, so you see the value before you pay.
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Mobile money — first-class, not an afterthought (conversion_psychology.md). */}
      <div className="mkt-card" style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 3px' }}>
            Pay with Mobile Money
          </p>
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-3)', margin: 0 }}>
            MTN Mobile Money &amp; Airtel Money. No card required.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 800, color: '#000', background: '#ffcc00', padding: '9px 15px', borderRadius: 10 }}>
            MTN MoMo
          </span>
          <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 800, color: '#fff', background: '#e40000', padding: '9px 15px', borderRadius: 10 }}>
            Airtel Money
          </span>
        </div>
      </div>
    </div>
  );
}
