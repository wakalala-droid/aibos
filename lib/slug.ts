/**
 * The web handle a hospitality unit answers to on a property's own website.
 *
 * This rule has to agree EXACTLY with `_slugify` in aibos-api/hospitality.py,
 * because a mismatch is invisible: the site deploys, looks perfect, and one
 * residence answers "that residence does not exist" forever. It was already
 * written out twice in the interface and was about to be written a third time
 * for the admin panel, so it lives here once.
 *
 * Environment-neutral on purpose — imported from client components and from
 * server route handlers alike, so it must not touch `window` or `next/headers`.
 */
export function slugFrom(name: string): string {
  return String(name ?? '')
    .split('')
    .map((c) => (/[a-z0-9]/i.test(c) ? c.toLowerCase() : '-'))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
