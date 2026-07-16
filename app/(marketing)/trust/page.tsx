import type { Metadata } from 'next';
import Link from 'next/link';
import Reveal from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Trust Center',
  description:
    'Your numbers are yours, and AIBOS keeps them that way. Export anytime, private AI that never trains on your data, no fabricated trends, and a free tier so you can prove it before you pay.',
  alternates: { canonical: '/trust' },
};

const PROMISES: { title: string; body: string; accent: string }[] = [
  {
    title: 'Your data stays yours',
    body: 'Export your full history anytime, on any plan, including after you cancel. We will never hold your numbers hostage to keep you subscribed.',
    accent: 'var(--e-fin)',
  },
  {
    title: 'AI without the leak risk',
    body: 'Your data is sent to the AI model only to answer your question, and is never used to train anyone’s model. No third party gets to learn from your business.',
    accent: 'var(--e-dec)',
  },
  {
    title: 'No fabrication',
    body: 'AIBOS refuses to invent a trend it cannot see. If a file has no time axis, it tells you, instead of drawing a confident line through nothing.',
    accent: 'var(--e-fore)',
  },
  {
    title: 'You see how it read your file',
    body: 'A plain-English manifest shows exactly which columns it understood and what it ignored, line by line. No black box, no “trust us”.',
    accent: 'var(--e-ops)',
  },
  {
    title: 'Built on solid foundations',
    body: 'Sign-in and storage run on Supabase with enterprise-grade auth and row-level isolation, so one business can never see another’s numbers.',
    accent: 'var(--e-cust)',
  },
  {
    title: 'Prove it safely',
    body: 'Start on the free tier with your own data before you pay a single Kwacha. Trust should be earned on your numbers, not on our marketing.',
    accent: 'var(--e-fin)',
  },
];

export default function TrustPage() {
  return (
    <>
      {/* Hero */}
      <section className="mkt-section mkt-section--tight" style={{ position: 'relative', overflow: 'hidden' }}>
        <span className="mkt-glow" style={{ top: '-30%', right: '-5%', width: 460, height: 460, background: 'radial-gradient(circle, rgba(10,143,199,0.22), transparent 60%)' }} />
        <div className="mkt-wrap" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Reveal>
            <p className="mkt-eyebrow">Trust Center</p>
            <h1 className="mkt-h1" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', maxWidth: 780, marginInline: 'auto' }}>
              Your numbers are yours. Here’s exactly how we keep them that way.
            </h1>
            <p className="mkt-lead" style={{ marginTop: 18, marginInline: 'auto', maxWidth: 560 }}>
              The most sensitive thing you’ll ever upload is your own money. We built AIBOS so that trusting it with that is the easy part.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Promise grid */}
      <section className="mkt-section mkt-section--tight" aria-label="Our promises">
        <div className="mkt-wrap">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {PROMISES.map((p, i) => (
              <Reveal key={p.title} delay={(i % 3) * 0.07}>
                <div className="mkt-card" style={{ height: '100%', borderTop: `2px solid ${p.accent}` }}>
                  <h2 className="mkt-h3" style={{ fontSize: '1.05rem' }}>{p.title}</h2>
                  <p className="mkt-body" style={{ marginTop: 10 }}>{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* No-fabrication highlight (dark band) */}
      <section className="mkt-dark mkt-section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="mkt-wrap mkt-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(28px, 5vw, 56px)', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <Reveal>
            <div>
              <p className="mkt-eyebrow" style={{ color: 'var(--cyan)' }}>The hardest promise, and the most important</p>
              <h2 className="mkt-h2">It would rather say “I don’t know” than lie to you.</h2>
              <p className="mkt-lead" style={{ marginTop: 18 }}>
                Most AI tools will happily invent a confident answer. AIBOS has a hard rule against it: if your data can’t support a trend, a forecast, or a number, it says so, and shows you why.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mkt-card">
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>How AIBOS read your file</p>
              {[
                ['date', 'read as the time axis', 'var(--good)'],
                ['revenue', 'read as income (ZMW)', 'var(--good)'],
                ['notes', 'ignored, free text', 'var(--text-4)'],
                ['forecast', 'unavailable, no time axis found', 'var(--warn)'],
              ].map(([col, note, c]) => (
                <div key={col} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-1)', fontSize: 'var(--fs-body)' }}>{col}</span>
                  <span style={{ color: c as string, fontSize: 'var(--fs-data)', textAlign: 'right' }}>{note}</span>
                </div>
              ))}
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '14px 0 0' }}>Illustrative. Every real upload shows its own manifest.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Contact + CTA */}
      <section className="mkt-section">
        <div className="mkt-wrap mkt-wrap--narrow" style={{ textAlign: 'center' }}>
          <Reveal>
            <h2 className="mkt-h2">Questions about security?</h2>
            <p className="mkt-lead" style={{ marginTop: 14, marginInline: 'auto', maxWidth: 520 }}>
              We’d rather you ask. Reach a real person at{' '}
              <a href="mailto:security@aibos.app" style={{ color: 'var(--cyan)', fontWeight: 600 }}>security@aibos.app</a>.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 28 }}>
              <Link href="/login" className="mkt-btn mkt-btn-primary">Start free, your data stays yours</Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-secondary">See pricing</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
