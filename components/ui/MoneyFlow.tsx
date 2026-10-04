'use client';

// See the sale land (UI/UX audit 2026-10 C10, B4 NumberFlow).
//
// A money figure that rolls from what the owner last saw to what it is now,
// so after recording a sale and coming back to Home, "Today" visibly moves
// from K400 to K850: cause and effect, never decoration. The last value seen
// is kept for this browser tab only (sessionStorage); with nothing kept, or
// for figures NumberFlow cannot write the way fmt() does (below zero, or a
// million and more, which fmt shortens to "K1.25M"), the figure is plain text.
// NumberFlow honours reduced motion and inherits Geist.

import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { fmt } from '@/lib/utils';

const KEY = 'aibos-last-seen-';

function lastSeen(name: string, fallback: number): number {
  try {
    const v = window.sessionStorage.getItem(KEY + name);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export default function MoneyFlow({ value, sym, rememberAs }: { value: number; sym: string; rememberAs: string }) {
  const [shown, setShown] = useState<number>(() => (typeof window === 'undefined' ? value : lastSeen(rememberAs, value)));

  useEffect(() => {
    setShown(value);
    try { window.sessionStorage.setItem(KEY + rememberAs, String(value)); } catch { /* private mode */ }
  }, [value, rememberAs]);

  const plain = (n: number) => n < 0 || Math.abs(n) >= 1_000_000;
  if (plain(value) || plain(shown)) return <>{fmt(value, true, sym)}</>;
  const cents = Math.round(Math.abs(shown) * 100) % 100 !== 0 || Math.round(Math.abs(value) * 100) % 100 !== 0;
  return (
    <NumberFlow
      value={shown}
      prefix={sym}
      locales="en-ZM"
      format={{ minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    />
  );
}
