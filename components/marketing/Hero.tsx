import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import HeroVideo from './HeroVideo';

const FACTS = ['Free to start', 'No card needed', 'Works on any phone', 'Your data stays yours'];

// The hero: the words, then the AI-BOS UI kit in action (HeroVideo). It
// arrives once on load in the kit's brand curve (website motion, see
// docs/AIBOS_UI_KIT.md). The headline and the video rise without fading, so
// the page's largest paint is never held back (UI/UX audit 2026-10 A20).
export default function Hero() {
  return (
    <section className="mkt-hero">
      <div className="mkt-wrap">
        <div className="mkt-hero-copy">
          <p className="mkt-eyebrow hero-in">The brain behind every business</p>
          <h1 className="mkt-display hero-lift">
            Ask your business <span className="mkt-brand">anything.</span>
          </h1>
          <p className="mkt-lead hero-in" style={{ '--d': '120ms' } as React.CSSProperties}>
            Record a sale, send an invoice or drop in a spreadsheet. AIBOS keeps your books,
            watches your cash and answers your questions in Kwacha, in plain words.
          </p>
          <div className="mkt-actions hero-in" style={{ '--d': '180ms' } as React.CSSProperties}>
            <Link href="/login" className="pill pill-primary pill-lg">
              Start free <ArrowRight aria-hidden />
            </Link>
            <Link href="/pricing" className="pill pill-quiet pill-lg">See pricing</Link>
          </div>
          <ul className="mkt-facts hero-in" style={{ '--d': '240ms' } as React.CSSProperties}>
            {FACTS.map((f) => (
              <li key={f}><Check aria-hidden />{f}</li>
            ))}
          </ul>
        </div>
        <div className="hero-lift" style={{ '--d': '160ms' } as React.CSSProperties}>
          <HeroVideo />
        </div>
      </div>
    </section>
  );
}
