'use client';

// The period chips (UI/UX audit 2026-10 B12): one tap for the usual windows.
// 44px, 18px words, the chosen one marked for screen readers with aria-pressed.

import { PERIODS, type PeriodKey } from '@/lib/period';

export default function PeriodChips({ value, onChange, label = 'Period' }: {
  value: PeriodKey; onChange: (k: PeriodKey) => void; label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="chips">
      {PERIODS.map((p) => (
        <button key={p.key} type="button" className="chip" aria-pressed={p.key === value} onClick={() => onChange(p.key)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
