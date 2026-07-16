'use client';

// Route-level error boundary for every dashboard page (audit F-03).
// Trust is the product: an unhandled render/data error must never surface the
// raw Next.js fallback on a screen where an owner makes financial decisions.
// Calm copy, a real recovery action, and an honest note that nothing was changed.

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real cause in the console for diagnosis; the UI stays calm.
    console.error('[AIBOS] dashboard error boundary:', error);
  }, [error]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24 }}>
      <div className="section-card" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div aria-hidden="true" style={{
          width: 44, height: 44, borderRadius: 12, margin: '0 auto 16px',
          background: 'var(--red-dim)', border: '1px solid color-mix(in srgb, var(--crit) 30%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L2 20h20L12 3z" stroke="var(--crit)" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
            <path d="M12 10v4M12 17v.5" stroke="var(--crit)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <h1 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 8px' }}>
          Something broke while loading this page
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', lineHeight: 1.6, margin: '0 0 20px' }}>
          Your numbers are safe — nothing was changed. This was a display problem
          on our side. Try again, or head back to your Overview.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              background: 'var(--cyan)', color: '#fff',
              fontSize: 'var(--fs-body)', fontWeight: 600,
            }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            style={{
              padding: '9px 18px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-md)', background: 'var(--bg-badge)',
              color: 'var(--text-2)', textDecoration: 'none',
              fontSize: 'var(--fs-body)', fontWeight: 600,
            }}
          >
            Back to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
