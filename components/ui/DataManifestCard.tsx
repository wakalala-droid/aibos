'use client';

// DataManifestCard — "How AIBOS read your file" (SAFEGUARD.md Layer 1).
// Shows column→role mappings with confidence, honesty flags, and (for
// item-level files) the per-item economics breakdown. Read-only, transparency-
// first: the user sees exactly how their data was interpreted.

import { useStore } from '@/lib/store';
import type { DataManifest, ItemBreakdownRow } from '@/lib/store';
import { Info, ScanSearch } from 'lucide-react';
import BentoCard from './BentoCard';
import { BAD, INK, signTone } from '@/lib/tone';

// What each column was read as, in the owner's words. Every figure is ink;
// only a low "how sure" is red (one palette, 5 Oct 2026).
const ROLE_WORD: Record<string, string> = {
  revenue: 'Sales', cost: 'Costs', profit: 'Profit', margin: 'Kept from sales',
  units: 'How many', price: 'Price', unit_cost: 'Cost of each',
  item: 'Item', category: 'Category', period: 'Month or date',
  customer: 'Customer', multiplier: 'Multiplier', demand: 'Demand',
  unknown: 'Not used',
};

function money(n: number, sym: string) {
  return `${n < 0 ? '-' : ''}${sym}${Math.abs(Math.round(n)).toLocaleString()}`;
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
    <BentoCard
      icon={<ScanSearch />}
      title="How AIBOS read your file"
      tag={isCross ? 'By item' : 'Over time'}
      style={{ marginBottom: 20 }}
      motion="tilt"
      text={<>Every column in your file, what AIBOS took it to be and how sure it is.
        {manifest.grouping_column ? <> Grouped by &ldquo;{manifest.grouping_column}&rdquo;.</> : null}</>}
    >
      {/* Honesty flags */}
      {manifest.flags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0 0' }}>
          {manifest.flags.map((f, i) => (
            <div key={i} role="note" className="mini-stat" style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Info size={20} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0, marginTop: 4, color: 'var(--text-3)' }} />
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>{f}</p>
            </div>
          ))}
        </div>
      )}

      {/* Column and what it was read as */}
      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Column</th>
              <th style={{ textAlign: 'left' }}>Read as</th>
              <th style={{ textAlign: 'right' }}>How sure</th>
            </tr>
          </thead>
          <tbody>
            {manifest.columns.map((c) => (
              <tr key={c.name}>
                <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{c.name}</td>
                <td style={{ color: 'var(--text-2)' }}>{ROLE_WORD[c.role] ?? c.role}</td>
                <td className="tnum" style={{ textAlign: 'right', color: c.confidence < 0.6 ? BAD : INK }}>
                  {Math.round(c.confidence * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Each item's money (item-level files) */}
      {breakdown.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p className="eyebrow">Each item</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'right' }}>Sales</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                  <th style={{ textAlign: 'right' }}>Profit</th>
                  <th style={{ textAlign: 'right' }}>Kept</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((b) => (
                  <tr key={b.item}>
                    <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{b.item}</td>
                    <td className="tnum" style={{ textAlign: 'right' }}>{money(b.revenue, sym)}</td>
                    <td className="tnum" style={{ textAlign: 'right' }}>{money(b.costs, sym)}</td>
                    <td className="tnum" style={{ textAlign: 'right', color: signTone(b.profit), fontWeight: 600 }}>{money(b.profit, sym)}</td>
                    <td className="tnum" style={{ textAlign: 'right', color: signTone(b.margin) }}>{b.margin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </BentoCard>
  );
}
