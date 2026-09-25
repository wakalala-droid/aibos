'use client';

/**
 * Plan prices in US dollars, with a switch to see them in Kwacha.
 *
 * Every plan is charged in US dollars (lib/tiers.ts). Many owners here think
 * in Kwacha, so any price can be shown converted at today's rate (lib/fx.ts),
 * always labelled as a conversion and never as what is charged. The choice is
 * remembered on this device and shared by every price on the page.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ZmwRate } from '@/lib/fx';

export type { ZmwRate } from '@/lib/fx';
export type PriceCurrency = 'USD' | 'ZMW';

/** $25, $29.50 or, converted, K491. Kwacha is rounded to whole Kwacha. */
export function planPrice(usd: number, currency: PriceCurrency, rate: ZmwRate | null): string {
  if (currency === 'ZMW' && rate) return `K${Math.round(usd * rate.rate).toLocaleString('en-US')}`;
  const whole = Math.abs(usd - Math.round(usd)) < 0.005;
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}

/** "$1 = K19.66" */
export function rateText(rate: ZmwRate): string {
  return `$1 = K${rate.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Which currency to show ───────────────────────────────────────────────────
const KEY = 'aibos-price-currency';
const EVENT = 'aibos:price-currency';

export function usePriceCurrency(): [PriceCurrency, (c: PriceCurrency) => void] {
  const [currency, setCurrency] = useState<PriceCurrency>('USD');
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'ZMW') setCurrency('ZMW');
    } catch { /* private window: US dollars */ }
    const on = (e: Event) => setCurrency((e as CustomEvent<PriceCurrency>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const choose = useCallback((c: PriceCurrency) => {
    setCurrency(c);
    try { localStorage.setItem(KEY, c); } catch { /* not remembered, still shown */ }
    // Every other price on the page follows.
    window.dispatchEvent(new CustomEvent<PriceCurrency>(EVENT, { detail: c }));
  }, []);
  return [currency, choose];
}

// ── Today's rate ─────────────────────────────────────────────────────────────
let pending: Promise<ZmwRate | null> | null = null;

function loadRate(): Promise<ZmwRate | null> {
  pending ??= fetch('/api/fx')
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { rate?: number | null; asOf?: string | null } | null) =>
      d && typeof d.rate === 'number' && d.rate > 0 ? { rate: d.rate, asOf: d.asOf ?? null } : null)
    .catch(() => {
      pending = null;              // try again next time rather than never
      return null;
    });
  return pending;
}

/**
 * Today's rate: `initial` when the server already read it (the pricing page),
 * otherwise read once per page load. `loading` is true until the answer is in;
 * after that a null rate means Kwacha cannot be shown right now.
 */
export function useZmwRate(initial?: ZmwRate | null, enabled = true): { rate: ZmwRate | null; loading: boolean } {
  const [rate, setRate] = useState<ZmwRate | null>(initial ?? null);
  const [loading, setLoading] = useState(initial === undefined);
  useEffect(() => {
    if (initial !== undefined || !enabled) return;
    let alive = true;
    void loadRate().then((r) => {
      if (!alive) return;
      setRate(r);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [initial, enabled]);
  return { rate, loading };
}

/**
 * Everything a price display needs. `currency` is what is actually shown:
 * Kwacha only once there is a rate to convert with, US dollars otherwise.
 * `eager` reads the rate straight away (a page with the switch on it, which
 * must know whether Kwacha is available); otherwise only once Kwacha is chosen.
 */
export function usePlanPricing(initial?: ZmwRate | null, eager = true) {
  const [chosen, choose] = usePriceCurrency();
  const { rate, loading } = useZmwRate(initial, eager || chosen === 'ZMW');
  const currency: PriceCurrency = chosen === 'ZMW' && rate ? 'ZMW' : 'USD';
  const fmt = useCallback((usd: number) => planPrice(usd, currency, rate), [currency, rate]);
  /** "$25 a month" or "about K491 a month". */
  const perMonth = useCallback((usd: number) => `${currency === 'ZMW' ? 'about ' : ''}${fmt(usd)} a month`, [currency, fmt]);
  return { currency, choose, rate, loading, fmt, perMonth };
}
