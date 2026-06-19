'use client';
import { fmt } from '@/lib/utils';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  sym?: string;
  currency?: boolean;
}

export default function ChartTooltip({ active, payload, label, sym = 'K', currency = true }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--tooltip-bg)',
      border: '1px solid var(--tooltip-border)',
      borderRadius: 8, padding: '10px 14px',
      boxShadow: 'var(--shadow-lg)',
    }}>
      {label && (
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', margin: '0 0 6px' }}>{label}</p>
      )}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 600, color: p.stroke ?? p.fill ?? p.color, margin: '2px 0' }}>
          {p.name}: {currency ? fmt(Number(p.value), true, sym) : p.value}
        </p>
      ))}
    </div>
  );
}
