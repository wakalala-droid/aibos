'use client';

// A money figure in the redesign's voice: light-weight digits, tight
// tracking and the ngwee small and raised ("K24,630⁵⁰"), the way Mercury sets
// a balance. With `roll` it rolls to a new value (NumberFlow), so a figure
// that changes because the owner did something visibly moves. With
// `rememberAs` it starts from the figure last seen in this tab, so coming back
// Home after recording a sale shows the sale land (UI/UX audit C10).
// Screen readers get the whole amount as one phrase ("K24,630.50").

import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { fmt } from '@/lib/utils';

const KEY = 'aibos-last-seen-';

function lastSeen(name: string | undefined, fallback: number): number {
  if (!name || typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(KEY + name);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export default function BigMoney({ value, sym, size = 'hero', roll = false, tone, rememberAs }: {
  value: number;
  sym: string;
  size?: 'hero' | 'lg' | 'md';
  roll?: boolean;
  /** Colour for money in or out; omit for ink. */
  tone?: 'in' | 'out';
  /** Start from the value last seen under this name (this tab only). */
  rememberAs?: string;
}) {
  const target = Number.isFinite(value) ? value : 0;
  const [v, setV] = useState<number>(() => lastSeen(rememberAs, target));
  useEffect(() => {
    setV(target);
    if (rememberAs) { try { window.sessionStorage.setItem(KEY + rememberAs, String(target)); } catch { /* private mode */ } }
  }, [target, rememberAs]);

  const neg = v < 0;
  const abs = Math.abs(v);
  const totalCents = Math.round(abs * 100);
  const whole = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const color = tone === 'in' ? 'var(--green)' : tone === 'out' ? 'var(--red)' : undefined;
  const sign = neg ? '−' : tone === 'in' ? '+' : tone === 'out' ? '−' : '';
  const said = `${target < 0 || tone === 'out' ? 'minus ' : tone === 'in' ? 'plus ' : ''}${fmt(Math.abs(target), false, sym)}`;

  if (size === 'md' && !roll) {
    return (
      <span className="money money-md" style={color ? { color } : undefined}>
        <span className="sr-only">{said}</span>
        <span aria-hidden="true">{sign}{fmt(Math.abs(v), false, sym).replace(/^-/, '')}</span>
      </span>
    );
  }

  return (
    <span className={`money money-${size}`} style={color ? { color } : undefined}>
      <span className="sr-only">{said}</span>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
        {roll ? (
          <NumberFlow value={whole} prefix={`${sign}${sym}`} locales="en-ZM" format={{ maximumFractionDigits: 0 }} />
        ) : (
          <span>{sign}{sym}{whole.toLocaleString('en-ZM')}</span>
        )}
        {size !== 'md' || cents ? (
          <span className="money-cents">
            {roll ? <NumberFlow value={cents} prefix="." format={{ minimumIntegerDigits: 2 }} /> : `.${String(cents).padStart(2, '0')}`}
          </span>
        ) : null}
      </span>
    </span>
  );
}
