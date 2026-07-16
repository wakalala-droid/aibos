import type { Metadata } from 'next';
import Link from 'next/link';
import Reveal from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Our Story',
  description:
    'Why AIBOS exists: to give every African SME the kind of financial intelligence that used to be reserved for big companies, made affordable, priced in Kwacha, and built for how they actually run.',
  alternates: { canonical: '/about' },
};

// ── Founder details — the ONE place to edit. ───────────────────────────────
// Leave a field as '' to fall back to a placeholder. Set `photo` to an image in
// /public (e.g. '/marketing/founder.webp') to show a real portrait instead of
// the dashed frame; set `videoHref` to link an "Our Story" video.
const FOUNDER = {
  name: 'Wakalala Mulyokela',
  title: 'Founder & CEO',
  location: 'Lusaka, Zambia',
  photo: '/marketing/founder.jpeg', // portrait at public/marketing/founder.jpeg
  videoHref: '',                    // optional 'Our Story' video link
  quote: 'Ask your business anything.',
  story:
    'I kept picturing a world where every business simply ran: no nasty surprises, no finding out too late that you’d been bleeding cash just because nobody was turning the numbers into real insight. That’s the day I stopped wishing and started building AIBOS.',
};

const ARC: { eyebrow: string; title: string; body: string }[] = [
  {
    eyebrow: 'Your reality today',
    title: 'Smart owners, flying blind',
    body: 'Across Lusaka and beyond, brilliant business owners make life-or-death decisions on gut feel and month-old spreadsheets. Not because they’re careless, but because real financial insight has always been too expensive, too complex, or simply not built for them.',
  },
  {
    eyebrow: 'Your business tomorrow',
    title: 'A CFO in your pocket',
    body: 'Imagine asking your business a question in plain words and getting a straight answer, in Kwacha, in seconds. Knowing your runway before it runs out. Seeing which product really pays. That’s not enterprise software; that’s AIBOS, and it costs less than one bad decision.',
  },
  {
    eyebrow: 'The world we’re building',
    title: 'Every African business, intelligent',
    body: 'When millions of SMEs can see clearly, they hire with confidence, price fairly, and survive the lean months. We think that’s how economies are built: not from the top down, but from every shop, restaurant and workshop getting a little bit smarter.',
  },
  {
    eyebrow: 'Our commitment to you',
    title: 'We earn it on your numbers',
    body: 'We will price in your currency, take mobile money, never hold your data hostage, and never invent a number we can’t back. You can start free and judge us on your own business, which is exactly how it should be.',
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Vision hero */}
      <section className="mkt-section" style={{ position: 'relative', overflow: 'hidden' }}>
        <span className="mkt-glow" style={{ top: '-25%', left: '-8%', width: 480, height: 480, background: 'radial-gradient(circle, rgba(224,121,42,0.22), transparent 60%)' }} />
        <span className="mkt-glow" style={{ bottom: '-30%', right: '-8%', width: 420, height: 420, background: 'radial-gradient(circle, rgba(10,143,199,0.18), transparent 62%)' }} />
        <div className="mkt-wrap" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Reveal>
            <p className="mkt-eyebrow">Our story</p>
            <h1 className="mkt-h1" style={{ maxWidth: 880, marginInline: 'auto' }}>
              Make every African business intelligent.
            </h1>
            <p className="mkt-lead" style={{ marginTop: 20, marginInline: 'auto', maxWidth: 580 }}>
              AIBOS exists for one reason: the tools that let big companies see clearly should belong to the small ones too, in their language, their currency, and their reach.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Founder story — driven by the FOUNDER object above. */}
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap">
          <Reveal>
            <div className="mkt-card mkt-2col" style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 'clamp(24px, 4vw, 48px)', alignItems: 'center' }}>
              {/* Portrait, or a dashed placeholder until a photo is provided */}
              {FOUNDER.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- founder portrait served from /public
                <img
                  src={FOUNDER.photo}
                  alt={FOUNDER.name ? `${FOUNDER.name}, ${FOUNDER.title}` : 'AIBOS founder'}
                  style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', objectPosition: 'center 25%', borderRadius: 16, border: '1px solid var(--border-md)' }}
                />
              ) : (
                <div
                  aria-hidden
                  style={{
                    aspectRatio: '4 / 5', borderRadius: 16,
                    background: 'linear-gradient(160deg, var(--bg-badge), var(--bg-card-hover))',
                    border: '1px dashed var(--border-strong)',
                    display: 'grid', placeItems: 'center',
                    color: 'var(--text-4)', fontSize: 'var(--fs-label)', textAlign: 'center', padding: 16,
                  }}
                >
                  Founder photo / “Our Story” video
                </div>
              )}

              <div>
                <p className="mkt-eyebrow">From the founder</p>
                <blockquote style={{ margin: 0, fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 600, lineHeight: 1.45, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                  “{FOUNDER.quote}”
                </blockquote>

                {FOUNDER.story && (
                  <p className="mkt-body" style={{ marginTop: 16, fontSize: 'var(--fs-body)' }}>{FOUNDER.story}</p>
                )}

                {FOUNDER.name ? (
                  <p style={{ marginTop: 18, fontSize: 'var(--fs-body)' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-1)' }}>{FOUNDER.name}</span>
                    <span style={{ color: 'var(--text-3)' }}>, {FOUNDER.title}{FOUNDER.location ? `, ${FOUNDER.location}` : ''}</span>
                  </p>
                ) : (
                  <p className="mkt-body" style={{ marginTop: 16 }}>
                    <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Placeholder — fill in the FOUNDER object at the top of this file.
                    </span>
                  </p>
                )}

                {FOUNDER.videoHref && (
                  <a href={FOUNDER.videoHref} className="mkt-btn mkt-btn-secondary mkt-btn-sm" style={{ marginTop: 16 }}>
                    Watch our story
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Narrative arc */}
      <section className="mkt-section mkt-section--tight" aria-label="Why we exist">
        <div className="mkt-wrap mkt-wrap--narrow">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {ARC.map((s, i) => (
              <Reveal key={s.eyebrow} delay={i * 0.05}>
                <div className="mkt-card">
                  <p style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cyan)', margin: '0 0 10px' }}>
                    {s.eyebrow}
                  </p>
                  <h2 className="mkt-h3" style={{ fontSize: '1.25rem' }}>{s.title}</h2>
                  <p className="mkt-body" style={{ marginTop: 10, fontSize: 'var(--fs-body)' }}>{s.body}</p>
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
                <h2 className="mkt-h2" style={{ maxWidth: 560, marginInline: 'auto' }}>Build the future with us.</h2>
                <p className="mkt-lead" style={{ marginTop: 16, marginInline: 'auto', maxWidth: 460 }}>
                  Your business is exactly the kind we built this for. See what it can do, free, on your own numbers.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 30 }}>
                  <Link href="/login" className="mkt-btn mkt-btn-primary">Start free</Link>
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
