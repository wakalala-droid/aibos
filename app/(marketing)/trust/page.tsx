import type { Metadata } from 'next';
import { Download, LockKeyhole, Ban, FileSearch, Database, Sprout } from 'lucide-react';
import { BentoCard } from '@/components/kit';
import StartFree from '@/components/marketing/StartFree';

export const metadata: Metadata = {
  title: 'Trust Center',
  description:
    'Your numbers are yours and AIBOS keeps them that way. Export any time, private AI that never trains on your data, no fabricated trends and a free plan so you can prove it before you pay.',
  alternates: { canonical: '/trust' },
};

// Every promise is a kit bento card: the round icon, the spaced-capital
// title and plain words (docs/AIBOS_UI_KIT.md).
const PROMISES: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Download />,
    title: 'Your data stays yours',
    body: 'Export your full history any time, on any plan, even after you cancel. We will never hold your numbers hostage to keep you subscribed.',
  },
  {
    icon: <LockKeyhole />,
    title: 'AI without the leak risk',
    body: 'Your data goes to the AI model only to answer your question and is never used to train anyone’s model. No third party learns from your business.',
  },
  {
    icon: <Ban />,
    title: 'No made-up numbers',
    body: 'AIBOS will not invent a trend it cannot see. If a file has no dates, it tells you instead of drawing a confident line through nothing.',
  },
  {
    icon: <FileSearch />,
    title: 'You see how it read your file',
    body: 'A plain read-out shows which columns it understood and what it left out, line by line. No black box and no “trust us”.',
  },
  {
    icon: <Database />,
    title: 'Built on solid foundations',
    body: 'Sign-in and storage run on Supabase with row-level isolation, so one business can never see another’s numbers.',
  },
  {
    icon: <Sprout />,
    title: 'Prove it safely',
    body: 'Start on the free plan with your own numbers before you pay anything. Trust should be earned on your numbers, not on our marketing.',
  },
];

const READ_OUT: [column: string, reading: string][] = [
  ['date', 'The days of your sales'],
  ['revenue', 'Money in, in Kwacha'],
  ['notes', 'Words only, left out'],
  ['forecast', 'Not possible: no dates found'],
];

export default function TrustPage() {
  return (
    <>
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap" style={{ textAlign: 'center' }}>
          <p className="mkt-eyebrow">Trust Center</p>
          <h1 className="mkt-h1" style={{ maxWidth: 780, marginInline: 'auto' }}>
            Your numbers are yours. Here’s exactly how we keep them that way.
          </h1>
          <p className="mkt-lead" style={{ marginTop: 18, marginInline: 'auto', maxWidth: 560 }}>
            The most sensitive thing you will ever upload is your own money. We built AIBOS so that trusting it with that is the easy part.
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-section--tight" aria-label="Our promises" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="bento-grid">
            {PROMISES.map((p) => (
              <BentoCard key={p.title} className="span-2" icon={p.icon} title={p.title} titleAs="h2" text={p.body} />
            ))}
          </div>
        </div>
      </section>

      {/* The no-fabrication promise, on the kit's dark band */}
      <section className="mkt-dark mkt-section" data-theme="dark" aria-labelledby="honest-h">
        <div className="mkt-wrap mkt-split">
          <div>
            <p className="mkt-eyebrow">The hardest promise and the most important</p>
            <h2 id="honest-h" className="mkt-h2">It would rather say “I don’t know” than lie to you.</h2>
            <p className="mkt-lead" style={{ marginTop: 18 }}>
              Many AI tools will happily invent a confident answer. AIBOS has a hard rule against it: if your
              numbers cannot support a trend, a forecast or a figure, it says so and shows you why.
            </p>
          </div>
          <BentoCard icon={<FileSearch />} title="How AIBOS read your file" tag="Sample" titleAs="h3">
            <div style={{ marginTop: 12 }}>
              {READ_OUT.map(([column, reading]) => (
                <div key={column} className="row" style={{ minHeight: 44 }}>
                  <span className="row-main"><span className="row-title">{column}</span></span>
                  <span className="row-sub" style={{ textAlign: 'right' }}>{reading}</span>
                </div>
              ))}
            </div>
            <p className="mkt-preview-cap" style={{ marginTop: 12 }}>Every real upload shows its own read-out.</p>
          </BentoCard>
        </div>
      </section>

      <StartFree
        id="security-h"
        title="Questions about security?"
        text={<>We would rather you ask. Reach a real person at{' '}
          <a href="mailto:security@ai-bos.website" style={{ color: 'var(--text-1)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>security@ai-bos.website</a>.</>}
        primary={{ label: 'Start free, your data stays yours', href: '/login' }}
      />
    </>
  );
}
