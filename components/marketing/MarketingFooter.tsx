import Link from 'next/link';
import Image from 'next/image';

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/#engines', label: 'The five engines' },
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
      { href: 'mailto:hello@aibos.app', label: 'Contact' },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="mkt-footer mkt-dark" role="contentinfo">
      <div className="mkt-wrap" style={{ paddingBlock: 'clamp(48px, 7vw, 80px)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(2, minmax(140px, 1fr))',
            gap: 'clamp(28px, 5vw, 64px)',
          }}
          className="mkt-footer-grid"
        >
          {/* Brand + tagline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
              <Image src="/brand/aibos-mark-white.png" alt="" aria-hidden width={34} height={34} style={{ width: 34, height: 34, objectFit: 'contain' }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.03em', color: '#fff' }}>
                AI-BOS
              </span>
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.05rem', fontWeight: 700, color: '#e2e8f0', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              The brain behind every business.
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#9fabbd', margin: 0, lineHeight: 1.55, maxWidth: 320 }}>
              The AI business operating system for African SMEs. Priced in Kwacha,
              built for how you actually run.
            </p>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#707d8e', margin: '0 0 14px' }}>
                {col.title}
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', color: '#9fabbd', textDecoration: 'none' }}>
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
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#707d8e', margin: 0 }}>
            © {new Date().getFullYear()} AI-BOS · Lusaka, Zambia
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#707d8e', margin: 0 }}>
            Your data stays yours · Export anytime
          </p>
        </div>
      </div>
    </footer>
  );
}
