'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { TIERS, TIER_ORDER, type Tier } from '@/lib/tiers';
import type { CardPrices } from '@/lib/api';
import { usePlanPricing, type ZmwRate } from '@/lib/planPrice';
import PriceCurrencySwitch, { KwachaNote } from '@/components/ui/PriceCurrencySwitch';

type Billing = 'monthly' | 'annual';

/** What a plan costs in US dollars: Paddle's price when the page has it (the
 *  owner can change a price there), else the list price in lib/tiers.ts. */
function usdPrice(tier: Tier, billing: Billing, cardPrices: CardPrices | null): number {
  const meta = TIERS[tier];
  return cardPrices?.[tier]?.[billing]?.amount ?? (billing === 'annual' ? meta.priceAnnual : meta.priceMonthly);
}

function Check({ colour }: { colour: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 3 }}>
      <path d="M20 6L9 17l-5-5" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PricingTiers({ cardPrices = null, zmwRate }: {
  cardPrices?: CardPrices | null;
  /** Today's Kwacha rate, read by the page on the server (null: none today). */
  zmwRate?: ZmwRate | null;
}) {
  const reduce = useReducedMotion();
  const currentTier = useStore((s) => s.tier);
  const { isAuthenticated } = useAuth();
  const [billing, setBilling] = useState<Billing>('monthly');
  const { currency, choose, rate, loading, fmt } = usePlanPricing(zmwRate);

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
      return { label: `Choose ${TIERS[tier].name}`, href: checkout, primary: tier === 'proplus' };
    }
    return { label: `Start with ${TIERS[tier].name}`, href: `/login?redirectTo=${encodeURIComponent(checkout)}`, primary: tier === 'proplus' };
  }

  return (
    <div>
      {/* Billing toggle — monthly is the default; annual is opt-in, never pre-selected.
          Beside it, the switch to see every price in Kwacha. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '16px 24px', marginBottom: 36 }}>
      <div role="group" aria-label="Billing period" style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
        {(['monthly', 'annual'] as Billing[]).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={billing === b}
            onClick={() => setBilling(b)}
            style={{
              fontSize: 'var(--fs-body)', fontWeight: 600,
              padding: '9px 18px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${billing === b ? 'var(--cyan)' : 'var(--border-md)'}`,
              background: billing === b ? 'var(--cyan-dim)' : 'var(--bg-card)',
              color: billing === b ? 'var(--cyan)' : 'var(--text-2)',
            }}
          >
            {b === 'monthly' ? 'Monthly' : 'Annual'}
            {b === 'annual' && (
              <span style={{ fontSize: 'var(--fs-label)', marginLeft: 8, color: 'var(--good)' }}>
                2 months free
              </span>
            )}
          </button>
        ))}
      </div>
      <PriceCurrencySwitch currency={currency} onChange={choose} rate={rate} loading={loading} />
      </div>

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))', gap: 18 }}>
        {TIER_ORDER.map((tier, i) => {
          const meta = TIERS[tier];
          // Pro+ is the flagship — "AIBOS runs your day" is the story we lead with.
          const popular = tier === 'proplus';
          const free = meta.priceMonthly === 0;
          const usd = usdPrice(tier, billing, cardPrices);
          const per = billing === 'annual' ? 'year' : 'month';
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
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: meta.accent, margin: 0 }}>
                  {meta.name}
                </h3>
                {popular && (
                  <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)', padding: '3px 9px', borderRadius: 999 }}>
                    MOST POPULAR
                  </span>
                )}
              </div>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 18px' }}>
                {meta.tagline}
              </p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: !free && currency === 'ZMW' ? 6 : 20 }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
                  {free ? 'Free' : fmt(usd)}
                </span>
                <span style={{ fontSize: 15, color: 'var(--text-3)' }}>
                  {free ? 'forever' : `/${per}${currency === 'ZMW' ? ', about' : ''}`}
                </span>
              </div>
              {!free && currency === 'ZMW' && (
                <p style={{ fontSize: 15, color: 'var(--text-3)', margin: '0 0 20px' }}>
                  Charged as ${usd.toLocaleString('en-US')} a {per}
                </p>
              )}

              <ul style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {meta.inclusions.map((inc) => (
                  <li key={inc} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <Check colour={meta.accent} />
                    <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.45 }}>
                      {inc}
                    </span>
                  </li>
                ))}
              </ul>

              {action.disabled ? (
                <span style={{ textAlign: 'center', fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-3)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-md)', background: 'var(--bg-badge)' }}>
                  {action.label}
                </span>
              ) : (
                <Link href={action.href} className={`mkt-btn ${action.primary ? 'mkt-btn-primary' : 'mkt-btn-secondary'}`} style={{ justifyContent: 'center' }}>
                  {action.label}
                </Link>
              )}

              {tier === 'free' && (
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '12px 0 0', textAlign: 'center' }}>
                  Locked features stay visible, so you see the value before you pay.
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* How paying works: one way, said plainly (no drip pricing, no surprises). */}
      <div className="mkt-card" style={{ marginTop: 22 }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px' }}>
          Every plan renews automatically
        </p>
        <p style={{ fontSize: 16, color: 'var(--text-2)', margin: 0, lineHeight: 1.6, maxWidth: 820 }}>
          Pay by Visa, Mastercard, American Express, PayPal, Apple Pay or Google Pay, in US dollars. Your plan
          renews automatically each month or year until you cancel, which takes two clicks on Plan &amp; billing,
          and it stays on to the end of what you paid. Our online reseller Paddle.com takes the payment. Every
          payment has a{' '}
          <Link href="/refunds" style={{ color: 'var(--text-1)', textDecoration: 'underline', textUnderlineOffset: 3 }}>30-day money-back guarantee</Link>.
        </p>
        {currency === 'ZMW' && rate && <div style={{ marginTop: 12 }}><KwachaNote rate={rate} /></div>}
      </div>
    </div>
  );
}
