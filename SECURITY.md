# AI-BOS — Security notes

## Backend authentication & tenant isolation

Every data-bearing endpoint on the FastAPI backend (`aibos-api`) now requires a
verified Supabase JWT (`Depends(require_user)`): `/upload`, `/upload/switch-sheet`,
`/propose`, `/compute-metrics`, `/cabinet`, `/cabinet/{id}` (GET + DELETE),
`/data-studio/*`, `/chat`, `/payments/*`, and the whole Evolution spine. The
`user_id` comes only from the token, never the request body.

The in-memory file cabinet is **tenant-scoped**: every entry is stamped with its
owner's `user_id` and reads/writes go through `_owned_cabinet()`, which returns
404 for a missing *or* foreign id (existence is never leaked). `GET /cabinet`
lists only the caller's own files. This closes the previous cross-tenant IDOR
where any caller could list/read/delete another business's uploads.

CORS is locked to an env allowlist (`ALLOWED_ORIGINS`), not `*`, and credentials
are disabled (auth is a Bearer token, not a cookie). The Next.js `/api/proxy`
no longer emits `access-control-allow-origin: *`.

## Tier is server-authoritative and cannot be self-set

`lib/tiers.ts` (`canAccess`) and `components/ui/FeatureGate.tsx` gate the UI on
`profiles.tier`, hydrated by `lib/profile.tsx`. The tier value itself is now
**write-protected**:

- The `profiles` guard trigger (migration `0010_pin_tier.sql`) pins `tier` and
  its provenance columns to their previous values for any ordinary authenticated
  self-update — exactly as `role` is pinned. A user can no longer run
  `supabase.from('profiles').update({ tier: 'growth' })` from the browser.
- Paid tiers are granted **only** by the backend, via the service-role client,
  after a payment is confirmed (`_grant_tier` in `aibos-api/main.py`). Free-plan
  self-selection goes through the service-role route `/api/checkout/select-free`.
  Admins change tiers through the service-role admin API.

**Remaining follow-up — per-feature entitlement enforcement.** The backend now
knows *who* is calling but does not yet reject an authenticated *Free* user who
calls a Pro/Growth analysis endpoint directly; the tier check is still the client
gate for feature visibility. A follow-up should look up `profiles.tier` in the
backend and return 402/403 for features above the caller's tier. This is now a
metering concern, not an auth hole — the self-escalation and cross-tenant bugs
above are closed.

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
- **Self role/tier escalation is blocked.** RLS lets a user update their own
  profile row, so the `profiles_guard_role` trigger pins `role` **and** `tier`
  (plus tier provenance columns) to their previous values for ordinary
  self-updates — only the service-role admin/payment paths (or an existing admin)
  can change a `role` or `tier`. See migration `0010_pin_tier.sql`.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` — server only. Never prefix with `NEXT_PUBLIC_`.
- The anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is safe in the browser and is
  governed by RLS.
