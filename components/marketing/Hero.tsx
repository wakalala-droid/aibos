import Link from 'next/link';
import { ArrowRight, Check, Download } from 'lucide-react';
import HeroVideo from './HeroVideo';
import GetAndroidApp from '@/components/app/GetAndroidApp';

const FACTS = ['Free to start', 'No card needed', 'Works on any phone', 'Your data stays yours'];

// The hero: the words, then the AI-BOS UI kit in action (HeroVideo). No
// entrance animation here: the lead text is the largest paint on a phone and
// animating it delays it (UI/UX audit 2026-10 A20, the owner's speed rule).
export default function Hero() {
  return (
    <section className="mkt-hero">
      <div className="mkt-wrap">
        <div className="mkt-hero-copy">
          <p className="mkt-eyebrow">The brain behind every business</p>
          <h1 className="mkt-display">
            Ask your business <span className="mkt-brand">anything.</span>
          </h1>
          <p className="mkt-lead">
            Record a sale, send an invoice or drop in a spreadsheet. AIBOS keeps your books,
            watches your cash and answers your questions in Kwacha, in plain words.
          </p>
          {/* On an Android phone the app comes first: it downloads from here
              and opens on the sign-in, so Start free steps back (lib/nativeApp.ts). */}
          <div className="mkt-actions">
            <GetAndroidApp className="pill pill-primary pill-lg">
              Get the app <Download aria-hidden />
            </GetAndroidApp>
            <Link href="/login" className="pill pill-primary pill-lg unless-android">
              Start free <ArrowRight aria-hidden />
            </Link>
            <Link href="/login" className="pill pill-quiet pill-lg when-android">Start free</Link>
            <Link href="/pricing" className="pill pill-quiet pill-lg unless-android">See pricing</Link>
          </div>
          <ul className="mkt-facts">
            {FACTS.map((f) => (
              <li key={f}><Check aria-hidden />{f}</li>
            ))}
          </ul>
        </div>
        <div>
          <HeroVideo />
        </div>
      </div>
    </section>
  );
}
