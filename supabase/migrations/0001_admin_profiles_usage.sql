-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Admin / Profiles / Usage  (migration 0001)
-- ────────────────────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- It is IDEMPOTENT and NON-DESTRUCTIVE: it only adds what is missing, so it is
-- safe to run against the existing `profiles` table (which already holds
-- id / email / full_name / avatar_url / subscription_tier from the OAuth
-- callback) and safe to re-run.
--
-- After running:
--   • Storage → create a PUBLIC bucket named `logos` (for profile logos).
--   • Confirm `vwanheda@gmail.com` shows role='admin' in `profiles`.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. profiles ─────────────────────────────────────────────────────────────
-- Create only if it doesn't exist yet; otherwise we just add the new columns.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

-- New columns (each guarded, so existing rows/data are untouched).
alter table public.profiles add column if not exists email          text;
alter table public.profiles add column if not exists role           text not null default 'member';   -- 'member' | 'admin' | 'owner'
alter table public.profiles add column if not exists tier           text not null default 'free';     -- 'free' | 'pro' | 'growth'
alter table public.profiles add column if not exists business_name  text;
alter table public.profiles add column if not exists business_type  text;                              -- restaurant/retail/service/mine/hospitality/other
alter table public.profiles add column if not exists industry       text;
alter table public.profiles add column if not exists location       text default 'Lusaka';
alter table public.profiles add column if not exists currency       text default 'ZMW';
alter table public.profiles add column if not exists phone          text;
alter table public.profiles add column if not exists whatsapp       text;
alter table public.profiles add column if not exists contact_email  text;
alter table public.profiles add column if not exists logo_url       text;
alter table public.profiles add column if not exists tier_source    text default 'self';               -- 'self' | 'payment' | 'admin_demo'
alter table public.profiles add column if not exists tier_granted_by text;
alter table public.profiles add column if not exists tier_granted_at timestamptz;
alter table public.profiles add column if not exists created_at     timestamptz default now();
alter table public.profiles add column if not exists updated_at     timestamptz default now();
alter table public.profiles add column if not exists last_active_at timestamptz;

-- Legacy columns the OAuth callback writes — keep them present so nothing breaks.
alter table public.profiles add column if not exists full_name         text;
alter table public.profiles add column if not exists avatar_url        text;
alter table public.profiles add column if not exists subscription_tier text default 'free';

-- Backfill the authoritative `tier` from the legacy `subscription_tier` where a
-- row predates this migration. coalesce keeps any real value already set.
update public.profiles
   set tier = coalesce(nullif(tier, ''), nullif(subscription_tier, ''), 'free')
 where tier is null or tier = '';

-- Keep business_name seeded from full_name for pre-existing rows (display only).
update public.profiles
   set business_name = full_name
 where business_name is null and full_name is not null;

-- ── 2. usage_events ─────────────────────────────────────────────────────────
create table if not exists public.usage_events (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  event      text not null,                 -- 'login'|'upload'|'chat'|'engine_view'|'page_view'
  engine     text,                          -- 'engine1'|'engine2'|'engine3'|'cross' (nullable)
  meta       jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists usage_events_user_idx    on public.usage_events(user_id);
create index if not exists usage_events_event_idx   on public.usage_events(event);
create index if not exists usage_events_created_idx on public.usage_events(created_at desc);

-- ── 3. admin_audit ──────────────────────────────────────────────────────────
create table if not exists public.admin_audit (
  id             bigserial primary key,
  admin_email    text not null,
  target_user_id uuid,
  action         text not null,             -- e.g. 'set_tier'
  detail         jsonb default '{}'::jsonb,
  created_at     timestamptz default now()
);
create index if not exists admin_audit_target_idx  on public.admin_audit(target_user_id);
create index if not exists admin_audit_created_idx on public.admin_audit(created_at desc);

-- ── 4. is_admin() helper ────────────────────────────────────────────────────
-- True when the *current* auth user has role='admin'. Used by RLS policies.
-- SECURITY DEFINER so the policy check itself isn't blocked by RLS on profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin'
  );
$$;

-- ── 5. updated_at trigger ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── 5b. Privilege guard ─────────────────────────────────────────────────────
-- RLS lets a user update their own row, which would otherwise let them self-set
-- role='admin'. This trigger pins `role` to its old value for ordinary
-- authenticated self-updates. The service-role client (auth.uid() is null, used
-- by the admin API) and existing admins are unaffected, so legitimate promotions
-- still work. `tier` is intentionally NOT pinned — the checkout flow updates the
-- user's own tier, and tier-gating is a client UX gate (see SECURITY.md).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ── 6. Row Level Security ───────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.usage_events enable row level security;
alter table public.admin_audit  enable row level security;

-- profiles: self read/update; admins read/update all; self insert (provisioning).
drop policy if exists profiles_select_self      on public.profiles;
drop policy if exists profiles_select_admin     on public.profiles;
drop policy if exists profiles_update_self      on public.profiles;
drop policy if exists profiles_update_admin     on public.profiles;
drop policy if exists profiles_insert_self      on public.profiles;

create policy profiles_select_self  on public.profiles for select using (auth.uid() = id);
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy profiles_update_self  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_update_admin on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy profiles_insert_self  on public.profiles for insert with check (auth.uid() = id);

-- usage_events: insert own, read own; admins read all.
drop policy if exists usage_insert_self  on public.usage_events;
drop policy if exists usage_select_self  on public.usage_events;
drop policy if exists usage_select_admin on public.usage_events;

create policy usage_insert_self  on public.usage_events for insert with check (auth.uid() = user_id);
create policy usage_select_self  on public.usage_events for select using (auth.uid() = user_id);
create policy usage_select_admin on public.usage_events for select using (public.is_admin());

-- admin_audit: admins read; writes go through the service-role server route only
-- (service role bypasses RLS, so no insert policy is granted to normal users).
drop policy if exists audit_select_admin on public.admin_audit;
create policy audit_select_admin on public.admin_audit for select using (public.is_admin());

-- ── 7. admin_account_overview view ──────────────────────────────────────────
-- One cheap select for the admin Accounts table: each profile + its usage counts.
-- security_invoker so the caller's RLS applies (admins see all; service role sees
-- all). Created on Postgres 15+ (Supabase default).
create or replace view public.admin_account_overview
with (security_invoker = true) as
select
  p.id,
  p.email,
  p.business_name,
  p.business_type,
  p.role,
  p.tier,
  p.tier_source,
  p.tier_granted_by,
  p.tier_granted_at,
  p.logo_url,
  p.created_at,
  p.last_active_at,
  coalesce(u.uploads, 0)  as uploads,
  coalesce(u.chats, 0)    as chats,
  coalesce(u.events, 0)   as events,
  u.last_event_at
from public.profiles p
left join (
  select
    user_id,
    count(*) filter (where event = 'upload') as uploads,
    count(*) filter (where event = 'chat')   as chats,
    count(*)                                  as events,
    max(created_at)                           as last_event_at
  from public.usage_events
  group by user_id
) u on u.user_id = p.id;

-- ── 8. Seed the bootstrap admin ─────────────────────────────────────────────
-- If the owner's profile row already exists, promote it. (If it doesn't exist
-- yet, the OAuth callback seeds role='admin' for allowlisted emails on next
-- login — see app/auth/callback/route.ts.)
update public.profiles set role = 'admin' where email = 'vwanheda@gmail.com';

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0001
-- ════════════════════════════════════════════════════════════════════════════
