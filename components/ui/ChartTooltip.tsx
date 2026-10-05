'use client';
import { fmt } from '@/lib/utils';
import { monthName } from '@/lib/change';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  sym?: string;
  currency?: boolean;
}

export default function ChartTooltip({ active, payload, label, sym = 'K', currency = true }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  // The redesign's hover card (2026-10): a white card, the month quietly on
  // top, each series as a small colour mark, its name and the figure in ink.
  return (
    <div style={{
      background: 'var(--tooltip-bg)',
      border: '1px solid var(--tooltip-border)',
      borderRadius: 'var(--radius-md)', padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 160,
    }}>
      {label && (
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 6px' }}>{monthName(label)}</p>
      )}
      {payload.filter((p: any) => p.value !== null && p.value !== undefined && !Array.isArray(p.value)).map((p: any, i: number) => (
        <p key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-body)', margin: '2px 0', color: 'var(--text-2)' }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: p.stroke && p.stroke !== 'none' ? p.stroke : (p.fill?.startsWith?.('url(') ? 'var(--chart-line)' : p.fill ?? p.color) }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
            {currency ? fmt(Number(p.value), true, sym) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}
