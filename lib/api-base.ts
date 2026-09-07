/**
 * WHERE THE BACKEND LIVES. One answer, one place.
 *
 * Server-side only. The browser never calls the API directly — everything goes
 * through /api/proxy, so this is read by the two route handlers that talk to it
 * and nothing else.
 *
 * WHY THIS IS NOT JUST `process.env.NEXT_PUBLIC_API_URL` INLINE.
 *
 * It was, in two files, each with the same fallback written out by hand:
 *
 *     process.env.NEXT_PUBLIC_API_URL ?? "https://aibos-api-production.up.railway.app"
 *
 * That fallback is now a dead host. Railway has no free tier any more, the app
 * there was removed, and the address answers "Application not found". So with
 * the variable unset or misspelled, the site would come up, look completely
 * normal, and quietly send every request to a machine that no longer exists.
 * The failure would surface as "nothing works" with nothing in the logs
 * pointing at the cause, which is the most expensive shape a bug can have.
 *
 * A default that is silently wrong is worse than no default. There is no
 * fallback now: if the variable is missing, callers say so plainly and return
 * 503, and whoever set the deployment up sees the actual problem in one read.
 *
 * The trailing slash is stripped here because it was stripped in one of the two
 * callers and not the other, so `…/health` worked and `…//health` was a 404
 * depending on which path a request took.
 */

export type ApiBase =
  | { ok: true; url: string }
  | { ok: false; reason: string };

export function apiBase(): ApiBase {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!raw) {
    return {
      ok: false,
      reason:
        "NEXT_PUBLIC_API_URL is not set, so there is no backend to call. " +
        "Set it to the API's address (no trailing slash) in the hosting " +
        "dashboard and redeploy — Next.js bakes NEXT_PUBLIC_* values into the " +
        "build, so setting it without a redeploy changes nothing.",
    };
  }

  if (!/^https?:\/\//i.test(raw)) {
    return {
      ok: false,
      reason: `NEXT_PUBLIC_API_URL is "${raw}", which has no http:// or https:// on the front.`,
    };
  }

  return { ok: true, url: raw.replace(/\/+$/, "") };
}
