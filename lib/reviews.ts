/**
 * Owners' reviews of AI-BOS: the shapes and words the website and the app share
 * (aibos-api reviews.py, migration 0048). No server or browser code here, so
 * the landing page and the Review AI-BOS page draw a review the same way: what
 * an owner sees in "How it will look" is what a visitor sees.
 */

/** One review an owner chose to share, as the website shows it. */
export interface PublicReview {
  key: string;
  rating: number;
  body: string;
  name: string;
  business: string;
  town: string;
  /** "November 2026": when it was written. */
  month: string;
  /** Only when the writer ticked "Show my logo with it". */
  logo: string | null;
}

/** GET /public/reviews. `average` only from MIN_FOR_AVERAGE reviews up. */
export interface PublicReviews {
  reviews: PublicReview[];
  count: number;
  average: number | null;
  min_for_average?: number;
  /** Logos of the businesses that agreed to show theirs, one each. */
  logos: { name: string; logo: string }[];
  ready?: boolean;
}

/** What each number of stars means, said the same way on the form and the card. */
export const STAR_WORDS = ['', 'Poor', 'Not good', 'All right', 'Good', 'Excellent'] as const;

/** Who said it, from what they chose to give: "Mwila, Mwila General Store". */
export function whoSaid(r: { name: string; business: string }): string {
  return [r.name.trim(), r.business.trim()].filter(Boolean).join(', ');
}

/** Where and when: "Lusaka · November 2026". */
export function whereWhen(r: { town: string; month?: string }): string {
  return [r.town.trim(), (r.month ?? '').trim()].filter(Boolean).join(' · ');
}
