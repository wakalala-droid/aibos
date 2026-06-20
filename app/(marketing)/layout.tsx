import type { Metadata } from 'next';
import './marketing.css';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';

/**
 * Marketing route group layout.
 *
 * Renders the public marketing surface WITHOUT the product AppShell
 * (sidebar / dashboard chrome) — AppShell detects marketing routes and
 * renders its children bare (see components/layout/AppShell.tsx).
 *
 * The `data-marketing` wrapper applies the warm premium-light skin from
 * marketing.css, scoped to this subtree only, so the product's saved
 * dark/light theme is never disturbed.
 */

export const metadata: Metadata = {
  metadataBase: new URL('https://aibos.app'),
  title: {
    default: 'AI-BOS — The brain behind every business',
    template: '%s · AI-BOS',
  },
  description:
    'AI-BOS is the AI business operating system for African SMEs. Ask your business anything and get the answer — in Kwacha — instantly. Start free.',
  openGraph: {
    title: 'AI-BOS — The brain behind every business',
    description:
      'A CFO, analyst and consultant in your pocket, priced in Kwacha. Upload your data and get answers, briefs and decisions in minutes.',
    type: 'website',
    locale: 'en_ZM',
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-marketing className="mkt-root">
      <a href="#mkt-main" className="skip-link">Skip to main content</a>
      <MarketingNav />
      <main id="mkt-main" tabIndex={-1} style={{ outline: 'none' }}>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
