import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/components/marketing/Hero';
import AskAnything from '@/components/marketing/AskAnything';
import Reveal from '@/components/marketing/Reveal';
import { ENGINES } from '@/components/marketing/engines';

export const metadata: Metadata = {
  title: 'AI-BOS — The brain behind every business',
  description:
    'Ask your business anything and get the answer, in Kwacha, instantly. AI-BOS reads your data and gives you a CFO, analyst and consultant in your pocket. Start free.',
  alternates: { canonical: '/' },
};

const TRUST_PILLS = [
  'Free to start',
  'Priced in ZMW',
  'MTN & Airtel Money',
  'Upload & go',
  'Your data stays yours',
];

const BEFORE_AFTER: { dim: string; before: string; after: string }[] = [
  { dim: 'Your numbers', before: 'Month-old figures you don’t fully trust', after: 'Live numbers, read straight from your files' },
  { dim: 'Stock & reorders', before: 'Guessing what to reorder, and when', after: 'Knows what’s moving and what’s about to run out' },
  { dim: 'Cashflow', before: 'You find out about a cash crunch when it hits', after: 'Warned days before your runway gets tight' },
  { dim: 'Decisions', before: 'Gut feel, generic advice, costly consultants', after: 'One clear, ranked next move from your own data' },
  { dim: 'Getting an answer', before: 'A week and a spreadsheet later', after: 'Ask in plain words, answered in seconds' },
];

const STEPS = [
  { n: '01', title: 'Upload your data', body: 'Drag in a spreadsheet or export — sales, costs, customers. No integrations, no setup project.' },
  { n: '02', title: 'AI-BOS reads & analyses it', body: 'It shows exactly how it read every file — what each column means and what it ignored. No black box, no invented trends.' },
  { n: '03', title: 'Get answers, briefs & decisions', body: 'Ask anything, get a daily brief to your phone, and see the one move that matters today.' },
];

const INDUSTRIES = [
  { name: 'Restaurants', line: 'Which dishes actually make money', tint: 'var(--e-cust)' },
  { name: 'Retail & e-commerce', line: 'What to restock before it sells out', tint: 'var(--e-ops)' },
  { name: 'Hospitality', line: 'Occupancy, rates and real margin', tint: 'var(--e-fore)' },
  { name: 'Mining & services', line: 'Project costs and cash, on time', tint: 'var(--e-dec)' },
];

const FIT_YES = [
  'You run a real business and already have sales or cost data in spreadsheets or a POS',
  'You make decisions on gut feel and wish you had the numbers first',
  'You want answers in your own language and currency, not enterprise jargon',
  'You’d rather start free and be convinced than sit through a sales demo',
];
const FIT_NOTYET = [
  'You haven’t started trading yet and have no numbers to read',
  'You need a full custom ERP rollout with a dedicated IT team',
];

function Check({ color = 'var(--good)' }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MarketingHome() {
  return (
    <>
      <Hero />

      {/* 2 · Trust pill strip */}
      <div className="mkt-wrap" style={{ marginTop: -12, marginBottom: 8 }}>
        <Reveal>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {TRUST_PILLS.map((p) => (
              <li key={p} className="mkt-pill"><span className="dot" aria-hidden />{p}</li>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* 3 + 4 · Before / After — the emotional turn */}
      <section className="mkt-section" aria-labelledby="shift-h">
        <div className="mkt-wrap">
          <Reveal>
            <p className="mkt-eyebrow">From flying blind → to seeing clearly</p>
            <h2 id="shift-h" className="mkt-h2" style={{ maxWidth: 720 }}>
              You’re smart. You’re just making decisions without the numbers.
            </h2>
          </Reveal>

          <div className="mkt-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 36 }}>
            {/* BEFORE */}
            <Reveal>
              <div className="mkt-card" style={{ height: '100%' }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)', margin: '0 0 18px' }}>
                  Your business today
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {BEFORE_AFTER.map((r) => (
                    <li key={r.dim}>
                      <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{r.dim}</span>
                      <span style={{ display: 'flex', gap: 9, alignItems: 'flex-start', color: 'var(--text-3)', fontSize: '0.92rem', lineHeight: 1.45 }}>
                        <span aria-hidden style={{ color: 'var(--text-4)', marginTop: 1 }}>✕</span>{r.before}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* AFTER */}
            <Reveal delay={0.1}>
              <div className="mkt-card" style={{ height: '100%', borderColor: 'color-mix(in srgb, var(--cyan) 35%, var(--border-md))', boxShadow: 'var(--shadow-lg)', background: 'linear-gradient(180deg, var(--cyan-dim), transparent 30%), var(--bg-card)' }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cyan)', margin: '0 0 18px' }}>
                  Your business with AI-BOS
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {BEFORE_AFTER.map((r) => (
                    <li key={r.dim}>
                      <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{r.dim}</span>
                      <span style={{ display: 'flex', gap: 9, alignItems: 'flex-start', color: 'var(--text-1)', fontSize: '0.92rem', fontWeight: 600, lineHeight: 1.45 }}>
                        <Check />{r.after}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 5 · The five engines */}
      <section id="engines" className="mkt-section mkt-section--tight" aria-labelledby="engines-h">
        <div className="mkt-wrap">
          <Reveal>
            <p className="mkt-eyebrow">Five expert departments, one command centre</p>
            <h2 id="engines-h" className="mkt-h2" style={{ maxWidth: 720 }}>
              Every part of your business, watched by an intelligence built for it.
            </h2>
          </Reveal>

          <div className="mkt-engines-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 40 }}>
            {ENGINES.map((eng, i) => (
              <Reveal key={eng.id} delay={i * 0.06}>
                <div className="mkt-card" style={{ height: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 96, height: 96, marginBottom: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- decorative inline SVG sprite, not a next/image candidate */}
                    <img src={eng.sprite} alt="" className={`mkt-engine-sprite ${i % 2 === 0 ? 'mkt-float' : 'mkt-float-b'}`} />
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: eng.accentVar, marginBottom: 6 }}>{eng.role}</span>
                  <h3 className="mkt-h3" style={{ fontSize: '1.02rem' }}>{eng.name}</h3>
                  <p className="mkt-body" style={{ marginTop: 8, fontSize: '0.88rem' }}>{eng.value}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · Ask anything (dark wow band) */}
      <AskAnything />

      {/* 7 · How it works */}
      <section id="how" className="mkt-section" aria-labelledby="how-h">
        <div className="mkt-wrap">
          <Reveal>
            <p className="mkt-eyebrow">From upload to insight in minutes</p>
            <h2 id="how-h" className="mkt-h2" style={{ maxWidth: 640 }}>How it works</h2>
          </Reveal>
          <div className="mkt-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 40 }}>
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <div className="mkt-card" style={{ height: '100%' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', fontWeight: 600, color: 'var(--cyan)' }}>{s.n}</span>
                  <h3 className="mkt-h3" style={{ marginTop: 12 }}>{s.title}</h3>
                  <p className="mkt-body" style={{ marginTop: 10 }}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 8 · Who it's for */}
      <section id="who" className="mkt-section mkt-section--tight" aria-labelledby="who-h">
        <div className="mkt-wrap">
          <Reveal>
            <p className="mkt-eyebrow">Built for how you actually run</p>
            <h2 id="who-h" className="mkt-h2" style={{ maxWidth: 640 }}>Made for African SMEs — maybe yours.</h2>
          </Reveal>
          <div className="mkt-engines-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 36 }}>
            {INDUSTRIES.map((ind, i) => (
              <Reveal key={ind.name} delay={i * 0.07}>
                <div className="mkt-card" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
                  <span aria-hidden style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: ind.tint, opacity: 0.14, filter: 'blur(20px)' }} />
                  <h3 className="mkt-h3" style={{ position: 'relative' }}>{ind.name}</h3>
                  <p className="mkt-body" style={{ marginTop: 8, position: 'relative' }}>{ind.line}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p style={{ marginTop: 18, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-4)', textAlign: 'center' }}>
              Named Lusaka customer stories land here soon — we’ll only print real, permissioned ones.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 9 · Self-qualification */}
      <section className="mkt-section" aria-labelledby="fit-h">
        <div className="mkt-wrap mkt-wrap--narrow">
          <Reveal>
            <p className="mkt-eyebrow" style={{ textAlign: 'center' }}>The honest fit test</p>
            <h2 id="fit-h" className="mkt-h2" style={{ textAlign: 'center' }}>Is AI-BOS right for you?</h2>
          </Reveal>
          <div className="mkt-2col" style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 18, marginTop: 36 }}>
            <Reveal>
              <div className="mkt-card" style={{ height: '100%' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 16px' }}>It’s a strong fit if…</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {FIT_YES.map((t) => (
                    <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--text-2)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                      <Check />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mkt-card" style={{ height: '100%', background: 'var(--bg-badge)' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 16px' }}>Maybe not yet if…</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {FIT_NOTYET.map((t) => (
                    <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--text-3)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                      <span aria-hidden style={{ color: 'var(--text-4)', marginTop: 1 }}>—</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 10 · Trust strip */}
      <section id="trust" className="mkt-section mkt-section--tight" aria-labelledby="trust-h">
        <div className="mkt-wrap">
          <Reveal>
            <h2 id="trust-h" className="mkt-h2" style={{ textAlign: 'center', maxWidth: 640, marginInline: 'auto' }}>
              Your numbers are yours. Full stop.
            </h2>
          </Reveal>
          <div className="mkt-engines-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 32 }}>
            {[
              ['Your data stays yours', 'Export your full history on any plan — including after you cancel.'],
              ['Private AI', 'Your numbers are never used to train anyone’s model. No leak risk.'],
              ['No fabrication', 'AI-BOS refuses to invent a trend. If the data isn’t there, it says so.'],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.07}>
                <div className="mkt-card" style={{ height: '100%' }}>
                  <h3 className="mkt-h3" style={{ fontSize: '1rem' }}>{t}</h3>
                  <p className="mkt-body" style={{ marginTop: 8 }}>{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 11 · Final CTA */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal>
            <div className="mkt-card mkt-dark" style={{ textAlign: 'center', padding: 'clamp(40px, 6vw, 72px) clamp(24px, 5vw, 56px)', position: 'relative', overflow: 'hidden' }}>
              <span className="mkt-glow" style={{ top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 420, height: 420, background: 'radial-gradient(circle, rgba(0,212,255,0.35), transparent 60%)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <h2 className="mkt-h2" style={{ maxWidth: 600, marginInline: 'auto' }}>Ready to see your numbers think?</h2>
                <p className="mkt-lead" style={{ marginTop: 16, marginInline: 'auto', maxWidth: 480 }}>
                  Start free on your own data. Upgrade only when the value is obvious.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 30 }}>
                  <Link href="/login" className="mkt-btn mkt-btn-primary">Start free — upload your data</Link>
                  <Link href="/pricing" className="mkt-btn mkt-btn-secondary">See pricing</Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
