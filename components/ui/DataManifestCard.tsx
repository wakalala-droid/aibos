'use client';

// DataManifestCard — "How AI-BOS read your file" (SAFEGUARD.md Layer 1).
// Shows column→role mappings with confidence, honesty flags, and (for
// item-level files) the per-item economics breakdown. Read-only, transparency-
// first: the user sees exactly how their data was interpreted.

import { useStore } from '@/lib/store';
import type { DataManifest, ItemBreakdownRow } from '@/lib/store';
import SectionCard from './SectionCard';

const ROLE_COLOUR: Record<string, string> = {
  revenue: 'var(--good)', cost: 'var(--crit)', profit: 'var(--good)',
  margin: 'var(--e1)', units: 'var(--e3)', price: 'var(--e3)', unit_cost: 'var(--warn)',
  item: 'var(--e2)', category: 'var(--e2)', period: 'var(--cyan)',
  customer: 'var(--e2)', multiplier: 'var(--purple)', demand: 'var(--purple)',
  unknown: 'var(--text-4)',
};

function confTone(c: number) {
  return c >= 0.8 ? 'var(--good)' : c >= 0.6 ? 'var(--warn)' : 'var(--crit)';
}

function money(n: number, sym: string) {
  return `${sym}${Math.round(n).toLocaleString()}`;
}

export default function DataManifestCard({
  manifest: pManifest, breakdown: pBreakdown, currencySymbol: pSym,
}: {
  manifest?: DataManifest | null; breakdown?: ItemBreakdownRow[]; currencySymbol?: string;
} = {}) {
  const store = useStore();
  // Props win when provided (marketing/demo); otherwise read live store (in-app).
  const manifest = pManifest !== undefined ? pManifest : store.manifest;
  const breakdown = pBreakdown !== undefined ? pBreakdown : store.breakdown;
  const sym = pSym ?? store.currencySymbol ?? 'K';
  if (!manifest) return null;

  const isCross = manifest.data_shape === 'cross_sectional';

  return (
    <SectionCard
      title="How AI-BOS read your file"
      subtitle="Transparency-first — every column, how it was mapped, and how confident we are"
      delay={0.12}
    >
      {/* Shape badge */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 'var(--fs-label)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 10px',
          borderRadius: 6, color: isCross ? 'var(--warn)' : 'var(--cyan)',
          background: isCross ? 'color-mix(in srgb, var(--warn) 14%, transparent)' : 'var(--cyan-dim)',
          border: `1px solid color-mix(in srgb, ${isCross ? 'var(--warn)' : 'var(--cyan)'} 30%, transparent)`,
        }}>
          {isCross ? 'Item-level data (no time axis)' : 'Time-series data'}
        </span>
        {manifest.grouping_column && (
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            grouped by “{manifest.grouping_column}”
          </span>
        )}
      </div>

      {/* Honesty flags */}
      {manifest.flags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {manifest.flags.map((f, i) => (
            <div key={i} role="note" style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px',
              borderRadius: 8, background: 'var(--bg-badge)', border: '1px solid var(--border)',
            }}>
              <span aria-hidden="true" style={{ color: 'var(--warn)', fontWeight: 700, lineHeight: 1.4 }}>!</span>
              <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{f}</p>
            </div>
          ))}
        </div>
      )}

      {/* Column → role table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', fontSize: 'var(--fs-data)' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Column</th>
              <th style={{ textAlign: 'left' }}>Read as</th>
              <th style={{ textAlign: 'right' }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {manifest.columns.map((c) => (
              <tr key={c.name}>
                <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{c.name}</td>
                <td>
                  <span style={{
                    fontSize: 'var(--fs-label)', fontWeight: 700,
                    color: ROLE_COLOUR[c.role] ?? 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {c.role}
                  </span>
                </td>
                <td style={{ textAlign: 'right', color: confTone(c.confidence) }}>
                  {Math.round(c.confidence * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-item economics (Operations view) */}
      {breakdown.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{
            fontSize: 'var(--fs-label)', fontWeight: 700,
            color: 'var(--e3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px',
          }}>
            Per-item economics
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: 'var(--fs-data)' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                  <th style={{ textAlign: 'right' }}>Profit</th>
                  <th style={{ textAlign: 'right' }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((b) => {
                  const tone = b.profit >= 0 ? 'var(--good)' : 'var(--crit)';
                  return (
                    <tr key={b.item}>
                      <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{b.item}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{money(b.revenue, sym)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{money(b.costs, sym)}</td>
                      <td style={{ textAlign: 'right', color: tone, fontWeight: 700 }}>{money(b.profit, sym)}</td>
                      <td style={{ textAlign: 'right', color: tone }}>{b.margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
