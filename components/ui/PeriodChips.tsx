'use client';

// The period chips (UI/UX audit 2026-10 B12): one tap for the usual windows.
// 44px, 18px words, the chosen one marked for screen readers with aria-pressed.

import { PERIODS, type PeriodKey } from '@/lib/period';

export default function PeriodChips({ value, onChange, label = 'Period' }: {
  value: PeriodKey; onChange: (k: PeriodKey) => void; label?: string;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {PERIODS.map((p) => {
        const on = p.key === value;
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(p.key)}
            style={{
              padding: '0 14px', borderRadius: 999, cursor: 'pointer',
              fontSize: 'var(--fs-label)', fontWeight: 600,
              border: `1px solid ${on ? 'var(--cyan)' : 'var(--border-md)'}`,
              background: on ? 'var(--cyan-dim)' : 'transparent',
              color: on ? 'var(--cyan)' : 'var(--text-2)',
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
