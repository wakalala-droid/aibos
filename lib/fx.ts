/**
 * Today's US dollar to Kwacha rate, for showing plan prices in Kwacha.
 *
 * Plans are priced and charged in US dollars (lib/tiers.ts PRICE_CURRENCY). A
 * Kwacha figure is a conversion for reference only, so it must use a real,
 * recent rate: a number fixed in the code went stale (it said K26 to the
 * dollar when the market was under K20). The rate comes from ExchangeRate-API's
 * free open endpoint, which updates once a day and needs no key; their terms
 * ask for a credit, which the Kwacha note carries.
 *
 * Server-side only (the pricing page and /api/fx). If the rate cannot be read,
 * the answer is null and the Kwacha option is simply not offered: a guessed
 * rate would put a wrong price in front of a customer.
 */

export interface ZmwRate {
  /** Kwacha per US dollar. */
  rate: number;
  /** When the source last updated it (ISO), when it says. */
  asOf: string | null;
}

export const FX_SOURCE = { name: 'ExchangeRate-API', url: 'https://www.exchangerate-api.com' };

const FX_URL = 'https://open.er-api.com/v6/latest/USD';

/** Read the rate. Cached for six hours by Next (the source changes daily). */
export async function fetchZmwRate(): Promise<ZmwRate | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6_000);
  try {
    const res = await fetch(FX_URL, { signal: ctl.signal, next: { revalidate: 21_600 } });
    if (!res.ok) return null;
    const d = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    const rate = Number(d?.rates?.ZMW);
    // A Kwacha rate far outside anything plausible is a bad feed, not a price.
    if (d?.result !== 'success' || !Number.isFinite(rate) || rate < 5 || rate > 200) return null;
    const when = d.time_last_update_utc ? new Date(d.time_last_update_utc) : null;
    return { rate, asOf: when && !Number.isNaN(when.getTime()) ? when.toISOString() : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
