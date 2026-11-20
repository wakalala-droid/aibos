/**
 * The reviews owners chose to share, for the landing page. Server-side only.
 *
 * The page is regenerated every two minutes (ISR), and the API keeps its own
 * list a minute (aibos-api reviews.public), so a review an owner shares shows
 * within a few minutes. If the API is asleep, down or not set up yet
 * (migration 0048), the section is simply left off: the page never waits on
 * it and never shows a review that is not real.
 */
import { apiBase } from '@/lib/api-base';
import type { PublicReviews } from '@/lib/reviews';

export async function getPublicReviews(): Promise<PublicReviews | null> {
  const base = apiBase();
  if (!base.ok) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6_000);
  try {
    const res = await fetch(`${base.url}/public/reviews`, {
      signal: ctl.signal,
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<PublicReviews>;
    if (data.ready === false || !Array.isArray(data.reviews)) return null;
    return {
      reviews: data.reviews,
      count: typeof data.count === 'number' ? data.count : data.reviews.length,
      average: typeof data.average === 'number' ? data.average : null,
      min_for_average: data.min_for_average,
      logos: Array.isArray(data.logos) ? data.logos : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
