import type { Metadata } from 'next';
import Link from 'next/link';
import Reveal from '@/components/marketing/Reveal';
import PricingTiers from '@/components/marketing/PricingTiers';
import ROICalculator from '@/components/marketing/ROICalculator';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple plans priced in Kwacha, paid by MTN or Airtel Money. Start free on your own numbers and upgrade only when the value is obvious. No card, no lock-in, no surprises.',
  alternates: { canonical: '/pricing' },
};

const FEATURE_GLOSSARY: { term: string; plain: string }[] = [
  { term: 'An engine', plain: 'A whole department’s intelligence — Financial, Customer or Operations — not a single chart. Free gives you the Financial engine; Pro unlocks the rest.' },
  { term: 'AI CFO chat', plain: 'Ask your business anything in plain words, as often as you like. It answers from your own uploaded data, in Kwacha.' },
  { term: 'A scheduled brief', plain: 'The one number that matters, sent to your email (or WhatsApp) daily or weekly — so you don’t have to remember to check.' },
  { term: 'A location', plain: 'One shop, branch or site. Pro runs one beautifully; Growth is for when you’re juggling several at once.' },
];

const TIMELINE: { when: string; what: string }[] = [
  { when: 'Minutes', what: 'Upload a spreadsheet and see your P&L and cashflow read straight back to you.' },
  { when: 'An hour', what: 'Ask your first questions and set the brief that lands on your phone each morning.' },
  { when: 'A day', what: 'The full picture — money, customers and operations — in one command centre.' },
];

const TRUST: [string, string][] = [
  ['Cancel anytime', 'The cancel button is never hidden. Stop whenever you like — no phone call, no retention maze.'],
  ['Your data is yours', 'Export your full history on any plan, including after you cancel. We never hold it hostage.'],
  ['No surprise fees', 'The price you see is the price you pay. No drip pricing, no pre-ticked add-ons at checkout.'],
  ['Fair price changes', 'We give advance notice before any plan or price change. No silent increases.'],
];

export default function PricingPage() {
  return (
    <>
      {/* Header */}
      <section className="mkt-section mkt-section--tight" style={{ paddingBottom: 0 }}>
        <div className="mkt-wrap" style={{ textAlign: 'center' }}>
          <Reveal>
            <p className="mkt-eyebrow">Pricing · Priced in Kwacha</p>
            <h1 className="mkt-h1" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', maxWidth: 760, marginInline: 'auto' }}>
              One CFO for your business. Pay in ZMW.
            </h1>
            <p className="mkt-lead" style={{ marginTop: 18, marginInline: 'auto', maxWidth: 560 }}>
              Start free on your own numbers. Upgrade when the value is obvious — never before.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Tiers + mobile money */}
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap">
          <PricingTiers />
        </div>
      </section>

      {/* What counts as a feature */}
      <section className="mkt-section mkt-section--tight" aria-labelledby="glossary-h">
        <div className="mkt-wrap">
          <Reveal>
            <p className="mkt-eyebrow">Plain English, no jargon</p>
            <h2 id="glossary-h" className="mkt-h2" style={{ maxWidth: 640 }}>What counts as a feature</h2>
          </Reveal>
          <div className="mkt-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }}>
            {FEATURE_GLOSSARY.map((f, i) => (
              <Reveal key={f.term} delay={i * 0.06}>
                <div className="mkt-card" style={{ height: '100%' }}>
                  <h3 className="mkt-h3" style={{ fontSize: '1.02rem' }}>{f.term}</h3>
                  <p className="mkt-body" style={{ marginTop: 8 }}>{f.plain}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Locked-but-visible teaser — same pattern as inside the product. */}
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap">
          <Reveal>
            <div className="mkt-card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 280px' }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--e-cust)', margin: '0 0 10px' }}>
                  Locked-but-visible
                </p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-1)', margin: 0, lineHeight: 1.5 }}>
                  Your top 5% of customers drive{' '}
                  <span style={{ position: 'relative', filter: 'blur(6px)', userSelect: 'none' }} aria-hidden>≈38%</span>{' '}
                  of revenue.
                </p>
                <p className="mkt-body" style={{ marginTop: 8 }}>
                  We never hide that a feature exists — you see the value first, then choose to unlock the detail. No bait, no dead ends.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span aria-hidden style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 12, background: 'var(--bg-badge)', border: '1px solid var(--border-md)', color: 'var(--text-3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </span>
                <Link href="/login" className="mkt-btn mkt-btn-secondary mkt-btn-sm">Unlock with Pro</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ROI calculator */}
      <section className="mkt-section" aria-labelledby="roi-h">
        <div className="mkt-wrap">
          <Reveal>
            <p className="mkt-eyebrow" style={{ textAlign: 'center' }}>Ready to run the numbers?</p>
            <h2 id="roi-h" className="mkt-h2" style={{ textAlign: 'center', maxWidth: 640, marginInline: 'auto' }}>
              See what it’s worth to you
            </h2>
            <p className="mkt-lead" style={{ textAlign: 'center', marginTop: 14, marginInline: 'auto', maxWidth: 520 }}>
              Two sliders, an honest estimate. We’d rather under-promise than invent a number.
            </p>
          </Reveal>
          <div style={{ marginTop: 36 }}>
            <ROICalculator />
          </div>
        </div>
      </section>

      {/* Timeline & effort */}
      <section className="mkt-section mkt-section--tight" aria-labelledby="timeline-h">
        <div className="mkt-wrap">
          <Reveal>
            <p className="mkt-eyebrow">From upload to first insight</p>
            <h2 id="timeline-h" className="mkt-h2" style={{ maxWidth: 600 }}>Live in a day, not a quarter</h2>
          </Reveal>
          <div className="mkt-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 32 }}>
            {TIMELINE.map((t, i) => (
              <Reveal key={t.when} delay={i * 0.1}>
                <div className="mkt-card" style={{ height: '100%' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', fontWeight: 600, color: 'var(--cyan)' }}>{t.when}</span>
                  <p className="mkt-body" style={{ marginTop: 12, color: 'var(--text-2)' }}>{t.what}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p style={{ marginTop: 18, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-4)' }}>
              Effort from you: just your data. No IT project, no consultant, no migration.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Trust signals */}
      <section className="mkt-section mkt-section--tight" aria-labelledby="ptrust-h">
        <div className="mkt-wrap">
          <Reveal>
            <h2 id="ptrust-h" className="mkt-h2" style={{ textAlign: 'center', maxWidth: 600, marginInline: 'auto' }}>
              Priced to be fair — and to stay that way
            </h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginTop: 28 }}>
            {TRUST.map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.05}>
                <div className="mkt-card" style={{ height: '100%' }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px' }}>{t}</p>
                  <p className="mkt-body" style={{ fontSize: '0.84rem' }}>{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal>
            <div className="mkt-card mkt-dark" style={{ textAlign: 'center', padding: 'clamp(40px, 6vw, 72px) clamp(24px, 5vw, 56px)', position: 'relative', overflow: 'hidden' }}>
              <span className="mkt-glow" style={{ top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 420, height: 420, background: 'radial-gradient(circle, rgba(0,212,255,0.35), transparent 60%)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <h2 className="mkt-h2" style={{ maxWidth: 560, marginInline: 'auto' }}>Start free. Decide with proof.</h2>
                <p className="mkt-lead" style={{ marginTop: 16, marginInline: 'auto', maxWidth: 460 }}>
                  Upload your numbers, see it work, and only pay when it’s obvious. That’s the whole pitch.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 30 }}>
                  <Link href="/login" className="mkt-btn mkt-btn-primary">Start free — upload your data</Link>
                  <Link href="/" className="mkt-btn mkt-btn-secondary">Back to overview</Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
