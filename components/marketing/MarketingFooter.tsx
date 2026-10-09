import Link from 'next/link';
import Image from 'next/image';
import { LEGAL } from '@/lib/legal';

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/#features', label: 'Features' },
      { href: '/#how', label: 'How it works' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/login', label: 'Sign in' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'Our story' },
      { href: '/trust', label: 'Trust & security' },
      { href: `mailto:${LEGAL.email}`, label: 'Contact' },
      { href: LEGAL.phoneHref, label: LEGAL.phoneDisplay },
    ],
  },
  {
    // Paddle's review asks for these to be reachable from every page.
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/refunds', label: 'Refund Policy' },
      { href: '/privacy', label: 'Privacy Policy' },
    ],
  },
];

// The kit's dark surface: monochrome black, neutral greys, the white mark.
export default function MarketingFooter() {
  return (
    <footer className="mkt-footer mkt-dark" data-theme="dark" role="contentinfo">
      <div className="mkt-wrap" style={{ paddingBlock: 'clamp(48px, 7vw, 80px)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(3, minmax(140px, 1fr))',
            gap: 'clamp(28px, 5vw, 64px)',
          }}
          className="mkt-footer-grid"
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Image src="/brand/aibos-mark-white-glyph.png" alt="" aria-hidden width={32} height={32} style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <Image src="/brand/aibos-wordmark-white.png" alt="AIBOS" width={82} height={21} style={{ width: 82, height: 'auto', objectFit: 'contain' }} />
            </div>
            <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 8px' }}>
              The brain behind every business.
            </p>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0, lineHeight: 1.6, maxWidth: 320 }}>
              The AI business operating system for African SMEs. Answers in Kwacha,
              built for how you actually run.
            </p>
          </div>

          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="eyebrow" style={{ marginBottom: 12 }}>{col.title}</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="tap-link" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', textDecoration: 'none' }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div
          style={{
            marginTop: 'clamp(36px, 5vw, 56px)', paddingTop: 22,
            borderTop: '1px solid var(--border)',
            display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>
            © {new Date().getFullYear()} AIBOS · Lusaka, Zambia
          </p>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>
            Your data stays yours · Export any time
          </p>
        </div>
      </div>
    </footer>
  );
}
