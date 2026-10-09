'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sprout, TrendingUp, Sunrise, Building2, RefreshCw, type LucideIcon } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { TIERS, TIER_ORDER, type Tier } from '@/lib/tiers';
import type { CardPrices } from '@/lib/api';
import { usePlanPricing, type ZmwRate } from '@/lib/planPrice';
import PriceCurrencySwitch, { KwachaNote } from '@/components/ui/PriceCurrencySwitch';

type Billing = 'monthly' | 'annual';

// One round icon per plan, in ink like every icon in the kit.
const ICON: Record<Tier, LucideIcon> = { free: Sprout, pro: TrendingUp, proplus: Sunrise, growth: Building2 };

/** What a plan costs in US dollars: Paddle's price when the page has it (the
 *  owner can change a price there), else the list price in lib/tiers.ts. */
function usdPrice(tier: Tier, billing: Billing, cardPrices: CardPrices | null): number {
  const meta = TIERS[tier];
  return cardPrices?.[tier]?.[billing]?.amount ?? (billing === 'annual' ? meta.priceAnnual : meta.priceMonthly);
}

// The plans as the kit's bento cards: the round icon, the plan's name in
// spaced capitals, the price in the money voice, what it includes with a
// check in ink, and one pill. The brand pill marks the plan we lead with;
// every other action is a quiet pill (docs/AIBOS_UI_KIT.md).
export default function PricingTiers({ cardPrices = null, zmwRate }: {
  cardPrices?: CardPrices | null;
  /** Today's Kwacha rate, read by the page on the server (null: none today). */
  zmwRate?: ZmwRate | null;
}) {
  const currentTier = useStore((s) => s.tier);
  const { isAuthenticated } = useAuth();
  const [billing, setBilling] = useState<Billing>('monthly');
  const { currency, choose, rate, loading, fmt } = usePlanPricing(zmwRate);

  // CTA target for each tier. Logged-out visitors start free; a paid choice
  // routes them through sign-in to checkout for that plan (self-serve, no
  // contact-sales gate, conversion_psychology.md). Logged-in users go straight
  // to checkout, or see their current plan.
  function cta(tier: Tier): { label: string; href: string; primary: boolean; disabled?: boolean } {
    if (isAuthenticated && currentTier === tier) {
      return { label: 'Your current plan', href: '#', primary: false, disabled: true };
    }
    if (tier === 'free') {
      return isAuthenticated
        ? { label: 'Switch to Free', href: '/checkout?plan=free', primary: false }
        : { label: 'Start free', href: '/login', primary: false };
    }
    const checkout = `/checkout?plan=${tier}&billing=${billing}`;
    if (isAuthenticated) {
      return { label: `Choose ${TIERS[tier].name}`, href: checkout, primary: tier === 'proplus' };
    }
    return { label: `Start with ${TIERS[tier].name}`, href: `/login?redirectTo=${encodeURIComponent(checkout)}`, primary: tier === 'proplus' };
  }

  return (
    <div>
      {/* Monthly is the default; annual is opt-in, never pre-selected. Beside
          it, the switch to see every price in Kwacha. */}
      <div className="price-controls">
        <div className="seg" role="group" aria-label="Billing period">
          {(['monthly', 'annual'] as Billing[]).map((b) => (
            <button key={b} type="button" aria-pressed={billing === b} onClick={() => setBilling(b)}>
              {b === 'monthly' ? 'Monthly' : 'Annual'}
              {b === 'annual' && <span className="seg-note">2 months free</span>}
            </button>
          ))}
        </div>
        <PriceCurrencySwitch currency={currency} onChange={choose} rate={rate} loading={loading} />
      </div>

      <div className="price-grid">
        {TIER_ORDER.map((tier) => {
          const meta = TIERS[tier];
          const Icon = ICON[tier];
          // Pro+ is the flagship: "AIBOS runs your day" is the story we lead with.
          const lead = tier === 'proplus';
          const free = meta.priceMonthly === 0;
          const usd = usdPrice(tier, billing, cardPrices);
          const per = billing === 'annual' ? 'year' : 'month';
          const action = cta(tier);

          return (
            <article key={tier} className={`bento price-card${lead ? ' lead' : ''}`} aria-labelledby={`plan-${tier}`}>
              <div className="bento-head">
                <span className="bento-icon" aria-hidden="true"><Icon /></span>
                <div className="bento-main">
                  <div className="bento-titlerow">
                    <h3 id={`plan-${tier}`} className="bento-title">{meta.name}</h3>
                    {lead && <span className="bento-tag">Popular</span>}
                  </div>
                  <p className="bento-text">{meta.tagline}</p>
                </div>
              </div>

              <div className="price-figure">
                <span className="money">{free ? 'Free' : fmt(usd)}</span>
                <span className="price-per">{free ? 'forever' : `a ${per}${currency === 'ZMW' ? ', about' : ''}`}</span>
              </div>
              {!free && currency === 'ZMW' && (
                <p className="price-charged">Charged as ${usd.toLocaleString('en-US')} a {per}</p>
              )}

              <ul className="price-list">
                {meta.inclusions.map((inc) => (
                  <li key={inc} className={inc.startsWith('Everything in') ? 'price-base' : undefined}>
                    <Check aria-hidden />
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>

              {action.disabled ? (
                <span className="price-current">{action.label}</span>
              ) : (
                <Link href={action.href} className={`pill ${action.primary ? 'pill-primary' : 'pill-quiet'}`}>
                  {action.label}
                </Link>
              )}

              {tier === 'free' && (
                <p className="price-foot">Locked features stay visible, so you see the value before you pay.</p>
              )}
            </article>
          );
        })}
      </div>

      {/* How paying works: one way, said plainly (no drip pricing, no surprises). */}
      <section className="bento" style={{ marginTop: 12 }} aria-labelledby="renews-h">
        <div className="bento-head">
          <span className="bento-icon" aria-hidden="true"><RefreshCw /></span>
          <div className="bento-main">
            <div className="bento-titlerow">
              <h3 id="renews-h" className="bento-title">Every plan renews automatically</h3>
            </div>
            <p className="bento-text" style={{ maxWidth: 820 }}>
              Pay by Visa, Mastercard, American Express, PayPal, Apple Pay or Google Pay, in US dollars. Your plan
              renews automatically each month or year until you cancel. Cancelling takes two clicks on Plan &amp;
              billing and your plan stays on to the end of what you paid. Our online reseller Paddle.com takes the
              payment. Every payment has a{' '}
              <Link href="/refunds" style={{ color: 'var(--text-1)', textDecoration: 'underline', textUnderlineOffset: 3 }}>30-day money-back guarantee</Link>.
            </p>
            {currency === 'ZMW' && rate && <div style={{ marginTop: 12 }}><KwachaNote rate={rate} /></div>}
          </div>
        </div>
      </section>
    </div>
  );
}
