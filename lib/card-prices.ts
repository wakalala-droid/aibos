/**
 * The card prices, for the public pricing page. Server-side only.
 *
 * Card plans are priced in US dollars in Paddle (it cannot charge in Kwacha),
 * and Paddle is where a card price lives: the owner can change one there
 * without a deploy. So the page asks the API what is on sale rather than
 * keeping a second copy of the numbers here to drift.
 *
 * The page is regenerated every ten minutes (ISR). If the API is asleep or
 * down, the card line is simply left off; the Kwacha prices never depend on it.
 * Only a LIVE Paddle account that customers can use is advertised: sandbox
 * prices are for testing, and a live one waits for its first real payment.
 */
import { apiBase } from '@/lib/api-base';
import type { CardPrices } from '@/lib/api';

export async function getCardPricesForPage(): Promise<CardPrices | null> {
  const base = apiBase();
  if (!base.ok) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6_000);
  try {
    const res = await fetch(`${base.url}/payments/paddle/config`, {
      signal: ctl.signal,
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const cfg = (await res.json()) as { enabled?: boolean; environment?: string; testers_only?: boolean; prices?: CardPrices };
    // Only once every customer can pay by card: before the owner's first real
    // card payment the option is shown to admins only (the API's go-live switch).
    if (!cfg.enabled || cfg.environment !== 'live' || cfg.testers_only || !cfg.prices) return null;
    return Object.keys(cfg.prices).length ? cfg.prices : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
