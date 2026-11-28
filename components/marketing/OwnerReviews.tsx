// What owners say about AI-BOS, on the landing page (20 Nov 2026).
//
// Every review its writer chose to share from Review AI-BOS in the app, newest
// first and low stars too, as they wrote them (aibos-api reviews.public). The
// average shows only once there are enough reviews to mean something. Under
// them, the logos of businesses that said yes to showing theirs: the ones in
// lib/trustedBy.ts (written permission) and reviewers who ticked the box.
//
// NOTHING HERE IS MADE UP. With no real review and no logo, the section is not
// drawn at all: no placeholder quotes, no sample names, no borrowed logos.
// Rendered on the server; the page refreshes it every two minutes.

import { getPublicReviews } from '@/lib/public-reviews';
import { TRUSTED_BY } from '@/lib/trustedBy';
import { bentoSpans } from '@/lib/bento-spans';
import ReviewCard from '@/components/marketing/ReviewCard';
import Rise from '@/components/marketing/Rise';
import UrlImage, { LOGO_FIT } from '@/components/ui/UrlImage';

export default async function OwnerReviews() {
  const data = await getPublicReviews();
  const reviews = data?.reviews ?? [];

  // One of each logo: the businesses that agreed in writing first.
  const seen = new Set<string>();
  const logos: { name: string; logo: string }[] = [];
  for (const l of [...TRUSTED_BY, ...(data?.logos ?? [])]) {
    if (!l.logo || seen.has(l.logo)) continue;
    seen.add(l.logo);
    logos.push(l);
  }

  if (reviews.length === 0 && logos.length === 0) return null;

  const spans = bentoSpans(reviews.length);
  const sub = data?.average != null
    ? `${data.average} out of 5 from ${data.count} owners. Newest first, low stars too, in their own words.`
    : 'Newest first, in their own words.';

  return (
    <section id="reviews" className="mkt-section" aria-labelledby="reviews-h" style={{ paddingTop: 0 }}>
      <div className="mkt-wrap">
        {reviews.length > 0 && (
          <>
            <Rise className="mkt-head">
              <div>
                <p className="mkt-eyebrow">From owners</p>
                <h2 id="reviews-h" className="mkt-h2">What owners say about AI-BOS.</h2>
              </div>
              <p className="mkt-head-sub">{sub}</p>
            </Rise>
            <Rise className="bento-grid" mode="stagger">
              {reviews.map((r, i) => (
                <ReviewCard key={r.key || i} review={r} className={spans[i]} />
              ))}
            </Rise>
          </>
        )}

        {logos.length > 0 && (
          <div className={reviews.length > 0 ? 'trusted-strip' : undefined}>
            {reviews.length > 0
              ? <p className="mkt-eyebrow">Businesses that work with AI-BOS</p>
              : <h2 id="reviews-h" className="mkt-eyebrow">Businesses that work with AI-BOS</h2>}
            <ul className="trusted-logos">
              {logos.map((l) => (
                <li key={l.logo}>
                  <UrlImage src={l.logo} alt={l.name} width={140} height={56} sizes="140px" style={LOGO_FIT} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
