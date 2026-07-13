-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Parties (customers & suppliers)  (migration 0018)  ·  audit item #6
-- ────────────────────────────────────────────────────────────────────────────
-- The entity that free-text payload names resolve to, so churn/CLV/ledgers
-- have something to hang on. One table for both sides of the counter: an SME
-- contact is often customer AND supplier (kind upgrades to 'both').
--
-- normalized_key uses the same normalization as business_memory
-- (lowercase, punctuation stripped, whitespace collapsed) so the entity a
-- payload resolves to and the alias Memory learns converge on the same key.
-- Stats (revenue, spend, balances) are DERIVED from business_events on read —
-- never stored here (twin doctrine).
--
-- IDEMPOTENT & NON-DESTRUCTIVE, same conventions as 0005/0012/0014. Run in
-- the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.parties (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,

  name           text        not null,               -- as the owner writes it
  normalized_key text        not null,               -- business_memory.normalize_key(name)
  kind           text        not null default 'customer',  -- customer|supplier|both

  phone          text,
  email          text,
  notes          text,

  first_seen_at  timestamptz,                        -- earliest event mention
  last_seen_at   timestamptz,                        -- latest event mention

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'parties_kind_chk') then
    alter table public.parties add constraint parties_kind_chk
      check (kind in ('customer','supplier','both'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'parties_user_key_uq') then
    alter table public.parties add constraint parties_user_key_uq
      unique (user_id, normalized_key);
  end if;
end $$;

create index if not exists parties_user_kind_idx on public.parties(user_id, kind);
create index if not exists parties_user_seen_idx on public.parties(user_id, last_seen_at desc);

drop trigger if exists parties_set_updated_at on public.parties;
create trigger parties_set_updated_at
  before update on public.parties
  for each row execute function public.set_updated_at();

-- ── Row Level Security (house pattern: self + admin-read) ────────────────────
alter table public.parties enable row level security;

drop policy if exists parties_select_self  on public.parties;
drop policy if exists parties_insert_self  on public.parties;
drop policy if exists parties_update_self  on public.parties;
drop policy if exists parties_delete_self  on public.parties;
drop policy if exists parties_select_admin on public.parties;

create policy parties_select_self  on public.parties for select using (auth.uid() = user_id);
create policy parties_insert_self  on public.parties for insert with check (auth.uid() = user_id);
create policy parties_update_self  on public.parties for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy parties_delete_self  on public.parties for delete using (auth.uid() = user_id);
create policy parties_select_admin on public.parties for select using (public.is_admin());

grant select, insert, update, delete on public.parties to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0018
-- ════════════════════════════════════════════════════════════════════════════
