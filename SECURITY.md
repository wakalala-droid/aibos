# AI-BOS — Security notes

## Tier gating is currently a client-side UX gate

`lib/tiers.ts` (`canAccess`) and `components/ui/FeatureGate.tsx` decide what to
show based on the user's `tier`. As of this change the tier is **sourced from
Supabase** (`profiles.tier`, hydrated by `lib/profile.tsx`), so it reflects
reality across devices instead of living only in the browser.

However, the gate itself still runs in the browser. A determined user could call
the analysis/`/chat` backend endpoints directly and bypass the visual lock.
**Server-side enforcement of paid API calls is a deliberate follow-up**, not done
here:

- The FastAPI backend (`aibos-api`) does not yet verify the caller's tier before
  serving forecast / anomaly / variance / breakeven / AI-chat responses.
- A follow-up should pass the Supabase JWT to the backend (or proxy), look up the
  user's `profiles.tier`, and return 402/403 for features above their tier.

Until then, the current client gate is retained (it is the UX boundary and the
upsell surface) and must not be regressed.

## Admin access control

- All cross-account admin actions go through **Node-runtime server routes** under
  `app/api/admin/*`. Each route calls `resolveCallerAdmin()` (`lib/admin.ts`) and
  returns **403** unless the caller is an admin (email in `ADMIN_EMAILS` **or**
  `profiles.role = 'admin'`).
- Cross-account writes use the **service-role** client (`lib/supabase-admin.ts`),
  which bypasses RLS. This key is read from `SUPABASE_SERVICE_ROLE_KEY` (server
  env only) and is **never** imported into client code or exposed to the browser.
- Client-side admin checks (showing the Admin nav item) are **cosmetic only** —
  the server route is the real boundary. `middleware.ts` additionally redirects
  non-allowlisted users away from `/admin`.
- Row Level Security is enabled on `profiles`, `usage_events`, and `admin_audit`
  (see `supabase/migrations/0001_admin_profiles_usage.sql`). Every admin mutation
  is recorded in `admin_audit`.
- **Self-role escalation is blocked.** RLS lets a user update their own profile
  row, so a `profiles_guard_role` trigger pins `role` to its previous value for
  ordinary self-updates — only the service-role admin API (or an existing admin)
  can change a `role`. `tier` is deliberately left self-settable (the checkout
  flow writes it and tier-gating is the client UX gate described above).

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` — server only. Never prefix with `NEXT_PUBLIC_`.
- The anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is safe in the browser and is
  governed by RLS.
