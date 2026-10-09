import type { Metadata } from 'next';
import { EyeOff, MessageCircle, Earth, HeartHandshake } from 'lucide-react';
import { BentoCard } from '@/components/kit';
import StartFree from '@/components/marketing/StartFree';

export const metadata: Metadata = {
  title: 'Our Story',
  description:
    'Why AIBOS exists: to give every African SME the kind of financial intelligence that used to be reserved for big companies, made affordable and built for how they actually run.',
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

// The story as kit bento cards: a round icon, a spaced-capital title and a tag.
const ARC: { icon: React.ReactNode; tag: string; title: string; body: string }[] = [
  {
    icon: <EyeOff />,
    tag: 'Today',
    title: 'Smart owners, flying blind',
    body: 'Across Lusaka and beyond, brilliant business owners make life-or-death decisions on gut feel and month-old spreadsheets. Not because they’re careless, but because real financial insight has always been too expensive, too complex or simply not built for them.',
  },
  {
    icon: <MessageCircle />,
    tag: 'Tomorrow',
    title: 'A CFO in your pocket',
    body: 'Imagine asking your business a question in plain words and getting a straight answer, in Kwacha, in seconds. Knowing your runway before it runs out. Seeing which product really pays. That’s not enterprise software; that’s AIBOS and it costs less than one bad decision.',
  },
  {
    icon: <Earth />,
    tag: 'The goal',
    title: 'Every African business, intelligent',
    body: 'When millions of SMEs can see clearly, they hire with confidence, price fairly and survive the lean months. We think that’s how economies are built: not from the top down, but from every shop, restaurant and workshop getting a little bit smarter.',
  },
  {
    icon: <HeartHandshake />,
    tag: 'Our promise',
    title: 'We earn it on your numbers',
    body: 'We will keep our prices public and simple, let you cancel any time, never hold your data hostage and never invent a number we can’t back. You can start free and judge us on your own business, which is exactly how it should be.',
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="mkt-section">
        <div className="mkt-wrap" style={{ textAlign: 'center' }}>
          <p className="mkt-eyebrow">Our story</p>
          <h1 className="mkt-h1" style={{ maxWidth: 880, marginInline: 'auto' }}>
            Make every African business intelligent.
          </h1>
          <p className="mkt-lead" style={{ marginTop: 20, marginInline: 'auto', maxWidth: 580 }}>
            AIBOS exists for one reason: the tools that let big companies see clearly should belong to the small ones too, in their language, their currency and their reach.
          </p>
        </div>
      </section>

      {/* Founder story, driven by the FOUNDER object above, on a kit bento surface. */}
      <section className="mkt-section mkt-section--tight" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <article className="bento mkt-founder" aria-labelledby="founder-h">
            {FOUNDER.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- founder portrait served from /public
              <img
                src={FOUNDER.photo}
                alt={FOUNDER.name ? `${FOUNDER.name}, ${FOUNDER.title}` : 'AIBOS founder'}
                className="mkt-founder-photo"
              />
            ) : (
              <div aria-hidden className="mkt-founder-photo mkt-founder-empty">Founder photo or “Our Story” video</div>
            )}

            <div>
              <div className="bento-titlerow">
                <h2 id="founder-h" className="bento-title">From the founder</h2>
                {FOUNDER.location && <span className="bento-tag">{FOUNDER.location.split(',')[0]}</span>}
              </div>
              <blockquote className="mkt-founder-quote">“{FOUNDER.quote}”</blockquote>
              {FOUNDER.story && <p className="bento-text" style={{ marginTop: 16 }}>{FOUNDER.story}</p>}
              {FOUNDER.name ? (
                <p className="bento-text" style={{ marginTop: 16 }}>
                  <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>{FOUNDER.name}</strong>, {FOUNDER.title}{FOUNDER.location ? `, ${FOUNDER.location}` : ''}
                </p>
              ) : (
                <p className="bento-text" style={{ marginTop: 16 }}>Placeholder: fill in the FOUNDER object at the top of this file.</p>
              )}
              {FOUNDER.videoHref && (
                <a href={FOUNDER.videoHref} className="pill pill-quiet" style={{ marginTop: 16 }}>Watch our story</a>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="mkt-section mkt-section--tight" aria-label="Why we exist" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="bento-grid">
            {ARC.map((s) => (
              <BentoCard key={s.title} className="span-3" icon={s.icon} title={s.title} tag={s.tag} titleAs="h2" text={s.body} />
            ))}
          </div>
        </div>
      </section>

      <StartFree
        id="about-start-h"
        title="Build the future with us."
        text="Your business is exactly the kind we built this for. See what it can do, free, on your own numbers."
      />
    </>
  );
}
