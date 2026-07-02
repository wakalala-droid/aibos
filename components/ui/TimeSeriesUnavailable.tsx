'use client';

// TimeSeriesUnavailable — honest state for time-series features (forecast, anomaly,
// variance, cash, breakeven) when the loaded file has NO date/period column.
// SAFEGUARD principle: never fabricate a trend over non-time rows. Instead, tell
// the user plainly and point them to the fix.

import SectionCard from './SectionCard';

export default function TimeSeriesUnavailable({
  title,
  feature,
}: {
  title: string;
  feature: string;
}) {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.7rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
          Financial Intelligence
        </p>
        <h1 style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>
          {title}
        </h1>
      </div>

      <SectionCard>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '32px 16px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="17" rx="2" stroke="var(--warn)" strokeWidth="1.5" />
            <path d="M3 9h18M8 2v4M16 2v4" stroke="var(--warn)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M8 14h2M13 14h3M8 17h6" stroke="var(--text-4)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
            {feature} needs a time series
          </p>
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.6, maxWidth: 460 }}>
            This file has <strong>item-level data</strong> (rows are products/categories, not months),
            so there is no time axis to project. AI-BOS won&apos;t invent one — that would be a
            fabricated trend.
          </p>
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', color: 'var(--text-3)', margin: 0, lineHeight: 1.6, maxWidth: 460 }}>
            To unlock {feature.toLowerCase()}, upload a file with a <strong>Month</strong> or{' '}
            <strong>Date</strong> column (one row per period). Your per-item economics are on the
            dashboard.
          </p>
        </div>
      </SectionCard>
    </>
  );
}
