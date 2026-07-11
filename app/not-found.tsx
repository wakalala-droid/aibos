// Branded 404 (audit F-03): a mistyped or stale URL routes the user calmly
// back into the product instead of showing the raw Next.js fallback.

import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 24, background: 'var(--bg-page)',
    }}>
      <div className="section-card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <p style={{
          fontSize: 'var(--fs-label)', fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--cyan)', margin: '0 0 10px',
        }}>
          404 — Page not found
        </p>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          This page doesn&apos;t exist
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', lineHeight: 1.6, margin: '0 0 20px' }}>
          The link may be old, or the address was mistyped. Your business data
          is unaffected — everything is where you left it.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block', padding: '10px 20px', borderRadius: 'var(--radius-md)',
            background: 'var(--cyan)', color: '#fff', textDecoration: 'none',
            fontSize: 'var(--fs-body)', fontWeight: 600,
          }}
        >
          Go to your Overview
        </Link>
      </div>
    </div>
  );
}
