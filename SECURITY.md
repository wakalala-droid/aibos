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

## Per-feature entitlement is enforced server-side

`aibos-api/entitlements.py` mirrors `lib/tiers.ts` (`_ACCESS`) and is the
authoritative gate. `require_feature(user_id, feature)` looks up `profiles.tier`
via the service-role client (cached ~60s; invalidated on a payment grant) and
raises **402** when the caller's tier doesn't include the feature. Enforced:

- `/chat` → `ai_chat` (Pro+). A Free account calling chat directly gets 402.
- `/upload` → when the file is detected as **Engine 2** (customer) or **Engine 3**
  (POS/operations) data, the tier is checked before any analysis is run or
  returned. Free accounts get 402 with an upgrade message; the whole
  Customer/Operations intelligence surface is Pro+.

The tier lookup **fails open on infrastructure error** (Supabase unreachable →
last-known/Free) so a brief outage never locks out a paying customer; a
definitive "free" answer still gates.

**Intentionally not gated:** the Engine-1 sub-features (forecast / anomaly /
variance / breakeven) are a *listed Free inclusion* — "…— preview" — and the
`FeatureGate` teasers are built from that real data (conversion_psychology.md
LOCKED-BUT-VISIBLE). Serving Engine-1 data to Free is by design, not a leak; the
frontend gate controls how much of the full feature is revealed. `full_history`
(Free = last 30 days) remains a display-window concern handled client-side.

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
