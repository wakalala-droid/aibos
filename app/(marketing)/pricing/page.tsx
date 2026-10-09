import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LayoutGrid, MessageCircle, Sunrise, Building2, LockKeyhole,
  RefreshCw, RotateCcw, Download, ReceiptText, BellRing,
} from 'lucide-react';
import { BentoCard } from '@/components/kit';
import HowItWorks from '@/components/marketing/HowItWorks';
import StartFree from '@/components/marketing/StartFree';
import PricingTiers from '@/components/marketing/PricingTiers';
import ROICalculator from '@/components/marketing/ROICalculator';
import PaddleLinkHandler from '@/components/marketing/PaddleLinkHandler';
import { getCardPricesForPage } from '@/lib/card-prices';
import { fetchZmwRate } from '@/lib/fx';

// Card prices come from Paddle through the API (lib/card-prices.ts); the page
// is rebuilt every ten minutes so a price changed there shows here. Today's
// Kwacha rate is read here too, so the Kwacha switch works on first paint.
export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple plans in US dollars, with Kwacha shown at today’s rate. Pay by card or PayPal and every plan renews automatically until you cancel. Start free on your own numbers and upgrade only when the value is obvious.',
  alternates: { canonical: '/pricing' },
};

// Every block below is a kit bento card (docs/AIBOS_UI_KIT.md).
const FEATURE_GLOSSARY: { icon: React.ReactNode; term: string; plain: string }[] = [
  { icon: <LayoutGrid />, term: 'Money, customers and operations', plain: 'The three things AIBOS watches for you, each with its own pages, not just a single chart. Free covers your money. Pro adds the customer and till sales reports.' },
  { icon: <MessageCircle />, term: 'Ask AIBOS', plain: 'Ask your business anything in plain words. It answers from your own records in Kwacha and remembers the conversation. Free gets 3 questions a day and Pro has no limit.' },
  { icon: <Sunrise />, term: 'The morning brief', plain: 'Your cash, yesterday’s sales, stock to reorder and the one thing to do, every morning at 06:30. Pro sends it by email and to your phone. Pro+ puts it on Home and sends it to WhatsApp (rolling out).' },
  { icon: <Building2 />, term: 'A business', plain: 'One venture with its own books. Every plan runs one. Growth runs several (a shop, a salon, a lodge) under one login, each with its own books.' },
];

const TRUST: { icon: React.ReactNode; title: string; body: string }[] = [
  { icon: <RefreshCw />, title: 'Renews automatically, cancel any time', body: 'Your plan renews automatically each month or year, so it never switches off by surprise. Cancel any time with two clicks on Plan & billing: it stays on to the end of what you paid and your card is not charged again.' },
  { icon: <RotateCcw />, title: 'Your money back if it is not right', body: 'Every payment has a 30-day money-back guarantee, no reason needed. Our refund policy has the details.' },
  { icon: <Download />, title: 'Your data is yours', body: 'Export your full history on any plan, even after you cancel. We never hold it hostage.' },
  { icon: <ReceiptText />, title: 'No surprise fees', body: 'The price you see is the price you pay. No drip pricing, no pre-ticked add-ons at checkout.' },
  { icon: <BellRing />, title: 'Fair price changes', body: 'We give advance notice before any plan or price change. No silent increases.' },
];

// Five cards of words only: three across, then two (the kit's big 4+2 card
// is for a card with a figure or chart in it; with words alone it stood empty).
const TRUST_SPANS = ['span-2', 'span-2', 'span-2', 'span-3', 'span-3'];

export default async function PricingPage() {
  const [cardPrices, zmwRate] = await Promise.all([getCardPricesForPage(), fetchZmwRate()]);
  return (
    <>
      <PaddleLinkHandler />
      <section className="mkt-section mkt-section--tight" style={{ paddingBottom: 0 }}>
        <div className="mkt-wrap" style={{ textAlign: 'center' }}>
          <p className="mkt-eyebrow">Pricing · US dollars or Kwacha · Cancel any time</p>
          <h1 className="mkt-h1" style={{ maxWidth: 760, marginInline: 'auto' }}>
            One expert for your business. One simple price.
          </h1>
          <p className="mkt-lead" style={{ marginTop: 18, marginInline: 'auto', maxWidth: 560 }}>
            Start free on your own numbers. Upgrade when the value is obvious, never before.
          </p>
        </div>
      </section>

      {/* Tiers, with the US dollar / Kwacha switch */}
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap" style={{ maxWidth: 1240 }}>
          <PricingTiers cardPrices={cardPrices} zmwRate={zmwRate} />
        </div>
      </section>

      {/* What counts as a feature */}
      <section className="mkt-section mkt-section--tight" aria-labelledby="glossary-h" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-head">
            <div>
              <p className="mkt-eyebrow">Plain words, no jargon</p>
              <h2 id="glossary-h" className="mkt-h2">What counts as a feature</h2>
            </div>
          </div>
          <div className="bento-grid">
            {FEATURE_GLOSSARY.map((f) => (
              <BentoCard key={f.term} className="span-3" icon={f.icon} title={f.term} text={f.plain} />
            ))}
          </div>
        </div>
      </section>

      {/* Locked but visible: the same pattern as inside the product. */}
      <section className="mkt-section mkt-section--tight" style={{ paddingTop: 0 }} aria-label="See it before you pay">
        <div className="mkt-wrap">
          <BentoCard
            icon={<LockKeyhole />}
            title="See it before you pay"
            tag="Pro"
            text={<>
              <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                Your top 5% of customers bring in{' '}
                <span style={{ filter: 'blur(6px)', userSelect: 'none' }} aria-hidden>about 38%</span>{' '}
                of your sales.
              </strong>{' '}
              We never hide that a feature exists. You see the value first, then choose to unlock the detail. No bait and no dead ends.
            </>}
            foot={<Link href="/login" className="pill pill-quiet">Unlock with Pro</Link>}
          />
        </div>
      </section>

      {/* ROI calculator */}
      <section className="mkt-section" aria-labelledby="roi-h" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-head">
            <div>
              <p className="mkt-eyebrow">Run the numbers</p>
              <h2 id="roi-h" className="mkt-h2">See what it is worth to you.</h2>
            </div>
            <p className="mkt-head-sub">Two sliders and an honest estimate. We would rather under-promise than invent a number.</p>
          </div>
          <ROICalculator />
        </div>
      </section>

      <HowItWorks id="pricing-how" />

      {/* Fair by design */}
      <section className="mkt-section" aria-labelledby="ptrust-h" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-head">
            <div>
              <p className="mkt-eyebrow">Fair by design</p>
              <h2 id="ptrust-h" className="mkt-h2">Priced to be fair and built to stay that way.</h2>
            </div>
          </div>
          <div className="bento-grid">
            {TRUST.map(({ icon, title, body }, i) => (
              <BentoCard key={title} className={TRUST_SPANS[i]} icon={icon} title={title} text={body} />
            ))}
          </div>
        </div>
      </section>

      <StartFree
        id="pricing-start-h"
        title="Start free. Decide with proof."
        text="Upload your numbers, see it work and only pay when it is obvious. That is the whole pitch."
        secondary={{ label: 'Back to overview', href: '/' }}
      />
    </>
  );
}
