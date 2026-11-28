/**
 * Businesses that work with AI-BOS and have said yes, in writing, to their logo
 * on the AI-BOS website. Shown on the landing page with the logos owners agree
 * to show with their reviews (components/marketing/OwnerReviews.tsx).
 *
 * EMPTY UNTIL A BUSINESS AGREES. A logo here is a public claim that the
 * business uses or works with AI-BOS. Add one only with that business's
 * written permission, and only for a real relationship: a pitch, a proposal
 * or a partnership still being discussed is not one. The strip stays hidden
 * while there is nothing to show.
 *
 * `logo` is a file in public/trusted/ (an SVG or a PNG at least 280px wide),
 * or an https address on Supabase storage.
 */

export interface TrustedBusiness {
  /** The business's name, read out in place of the logo. */
  name: string;
  logo: string;
}

export const TRUSTED_BY: TrustedBusiness[] = [];
