// One owner's review of AI-BOS, drawn the same way on the landing page and in
// "How it will look" on Review AI-BOS (app/dashboard/reviews), so an owner sees
// exactly what a visitor will. A kit bento card (hairline, one wash of light):
// the stars in ink, their words as they wrote them, who said it and where,
// and their logo only when they agreed to show it.
//
// No hooks and no 'use client': it renders on the server for the website and
// in the browser for the preview.

import { Star } from 'lucide-react';
import UrlImage, { LOGO_FIT } from '@/components/ui/UrlImage';
import { whoSaid, whereWhen, type PublicReview } from '@/lib/reviews';

/** The stars as one picture with words for a screen reader: "4 of 5 stars". */
export function Stars({ rating, size = 20 }: { rating: number; size?: number }) {
  return (
    <span className="review-stars" role="img" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true" width={size} height={size} strokeWidth={1.75}
          className={n <= rating ? 'is-on' : undefined} />
      ))}
    </span>
  );
}

type Shown = Pick<PublicReview, 'rating' | 'body' | 'name' | 'business' | 'town' | 'logo'> & { month?: string };

export default function ReviewCard({ review, className = '' }: { review: Shown; className?: string }) {
  const who = whoSaid(review) || 'An AI-BOS owner';
  const where = whereWhen(review);
  return (
    <figure className={`bento review-card ${className}`.trim()}>
      <div className="review-card-top">
        <Stars rating={review.rating} />
        {review.logo && (
          // The business is named under the words, so the logo says nothing new.
          <span className="review-card-logo">
            <UrlImage src={review.logo} alt="" width={112} height={40} sizes="112px" style={LOGO_FIT} />
          </span>
        )}
      </div>
      <blockquote className="review-card-words">
        <p>&ldquo;{review.body}&rdquo;</p>
      </blockquote>
      <figcaption className="review-card-who">
        <span className="review-card-name">{who}</span>
        {where && <span className="review-card-where">{where}</span>}
      </figcaption>
    </figure>
  );
}
