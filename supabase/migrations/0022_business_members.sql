-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Team members  (migration 0022)  ·  audit items #27, #28
-- ────────────────────────────────────────────────────────────────────────────
-- One-login tenancy becomes a membership model. A member acts inside the
-- OWNER's tenant (owner_id = the existing user_id tenant key everything is
-- already scoped by), with a role:
--
--   owner       — the account holder; full control (implicit, no row needed)
--   staff       — records events (they land PENDING — the per-role trust gate),
--                 sees Today + Schedule; no money pages, no confirm, no settings
--   accountant  — reads everything + exports; writes nothing
--
-- Backward compatible BY CONSTRUCTION: existing users have no rows, so the
-- resolver (membership.py) treats them as owner of their own tenant — nothing
-- changes until an owner invites someone.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.business_members (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid        not null references auth.users(id) on delete cascade,   -- the tenant
  member_id      uuid        references auth.users(id) on delete cascade,            -- null until invite accepted
  email          text        not null,                                              -- invited address
  role           text        not null default 'staff',
  status         text        not null default 'pending',   -- pending|active|revoked
  invited_by     uuid,
  invited_at     timestamptz not null default now(),
  accepted_at    timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'business_members_role_chk') then
    alter table public.business_members add constraint business_members_role_chk
      check (role in ('owner','staff','accountant'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_members_status_chk') then
    alter table public.business_members add constraint business_members_status_chk
      check (status in ('pending','active','revoked'));
  end if;
  -- One membership per (owner, email); re-inviting updates the same row.
  if not exists (select 1 from pg_constraint where conname = 'business_members_owner_email_uq') then
    alter table public.business_members add constraint business_members_owner_email_uq
      unique (owner_id, email);
  end if;
end $$;

create index if not exists business_members_member_idx on public.business_members(member_id) where member_id is not null;
create index if not exists business_members_owner_idx  on public.business_members(owner_id);
create index if not exists business_members_email_idx  on public.business_members(lower(email));

drop trigger if exists business_members_set_updated_at on public.business_members;
create trigger business_members_set_updated_at
  before update on public.business_members
  for each row execute function public.set_updated_at();

-- ── is_member(): does the caller belong to `tenant` at ≥ the given role rank? ─
-- SECURITY DEFINER so the check itself isn't blocked by RLS. Rank:
-- accountant(1) < staff(1 write) — we treat staff and accountant as siblings,
-- so callers pass the EXACT role set they accept.
create or replace function public.is_member(tenant uuid, roles text[])
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.business_members m
    where m.owner_id = tenant
      and m.member_id = auth.uid()
      and m.status = 'active'
      and m.role = any(roles)
  );
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- The owner manages their own roster; a member may read the row that grants
-- them access (to discover which tenant they belong to). Backend writes via
-- service role. No member-side writes.
alter table public.business_members enable row level security;

drop policy if exists business_members_select_owner  on public.business_members;
drop policy if exists business_members_select_self   on public.business_members;
drop policy if exists business_members_write_owner   on public.business_members;
drop policy if exists business_members_select_admin  on public.business_members;

create policy business_members_select_owner on public.business_members
  for select using (auth.uid() = owner_id);
create policy business_members_select_self  on public.business_members
  for select using (auth.uid() = member_id);
create policy business_members_write_owner  on public.business_members
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy business_members_select_admin on public.business_members
  for select using (public.is_admin());

grant select, insert, update, delete on public.business_members to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0022
-- ════════════════════════════════════════════════════════════════════════════
