import type { Metadata, Viewport } from 'next';
import '../navy.css';
import './marketing.css';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import NavyPage from '@/components/brand/NavyPage';

/**
 * Marketing route group layout.
 *
 * Renders the public marketing surface WITHOUT the product AppShell
 * (sidebar / dashboard chrome) — AppShell detects marketing routes and
 * renders its children bare (see components/layout/AppShell.tsx).
 *
 * The website is navy (owner, 10 Oct 2026: "too much white"). The wrapper
 * carries data-navy and data-theme="dark", so the kit's dark tokens resolve
 * here whatever theme the visitor saved in the product (that saved choice is
 * never touched) and app/navy.css turns them into the navy, shared with the
 * sign-in page. The product itself shows light, in islands that set
 * data-theme="light". Behind it all, the sky (NavyPage).
 */

export const viewport: Viewport = {
  // The phone's browser bar matches the navy.
  themeColor: '#050b18',
};

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
    <div data-marketing data-navy data-theme="dark" className="mkt-root">
      <NavyPage />
      <a href="#mkt-main" className="skip-link">Skip to main content</a>
      <MarketingNav />
      <main id="mkt-main" tabIndex={-1} style={{ outline: 'none' }}>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
