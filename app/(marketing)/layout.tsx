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
 * The wrapper carries data-theme="light", so the AI-BOS UI kit's own light
 * tokens resolve here whatever theme the visitor saved in the product (that
 * saved choice is never touched). Dark bands set data-theme="dark" on
 * themselves. marketing.css adds only the website's layout and headline
 * sizes on top of the kit (docs/AIBOS_UI_KIT.md).
 */

export const metadata: Metadata = {
  // The official domain. aibos.app was never ours: every canonical tag and
  // link-preview image pointed search engines and WhatsApp at somebody else.
  metadataBase: new URL('https://ai-bos.website'),
  title: {
    default: 'AIBOS · The brain behind every business',
    template: '%s · AIBOS',
  },
  description:
    'AIBOS is the AI business operating system for African SMEs. Ask your business anything and get the answer back in Kwacha, instantly. Start free.',
  openGraph: {
    title: 'AIBOS · The brain behind every business',
    description:
      'A CFO, analyst and consultant in your pocket, answering in Kwacha. Upload your data and get answers, briefs and decisions in minutes.',
    type: 'website',
    locale: 'en_ZM',
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-marketing data-theme="light" className="mkt-root">
      <a href="#mkt-main" className="skip-link">Skip to main content</a>
      <MarketingNav />
      <main id="mkt-main" tabIndex={-1} style={{ outline: 'none' }}>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
