-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Recommendations ledger  (migration 0021)  ·  audit item #20
-- ────────────────────────────────────────────────────────────────────────────
-- Recommendations become first-class rows so AIBOS can audit ITSELF: what it
-- advised, when, and whether the owner acted. "Runway warnings issued: 3;
-- taken: 3" is a trust feature no competitor ships.
--
-- One row per (user, fingerprint) — a recommendation that keeps firing is the
-- SAME advice refreshed (times_shown++), never a duplicate. fingerprint =
-- source_engine + normalized title (rec_store.py).
--
-- IDEMPOTENT & NON-DESTRUCTIVE, house conventions. Run in the Supabase SQL
-- editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.recommendations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,

  fingerprint    text        not null,
  source_engine  text        not null,
  title          text        not null,
  rationale      text,
  priority       text        not null default 'medium',
  confidence     numeric,
  evidence       jsonb       not null default '[]'::jsonb,
  impact         jsonb       not null default '{}'::jsonb,

  status         text        not null default 'open',   -- open|accepted|dismissed
  acted_at       timestamptz,
  first_shown_at timestamptz not null default now(),
  last_shown_at  timestamptz not null default now(),
  times_shown    integer     not null default 1,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recommendations_status_chk') then
    alter table public.recommendations add constraint recommendations_status_chk
      check (status in ('open','accepted','dismissed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recommendations_user_fp_uq') then
    alter table public.recommendations add constraint recommendations_user_fp_uq
      unique (user_id, fingerprint);
  end if;
end $$;

create index if not exists recommendations_user_status_idx
  on public.recommendations(user_id, status, last_shown_at desc);

drop trigger if exists recommendations_set_updated_at on public.recommendations;
create trigger recommendations_set_updated_at
  before update on public.recommendations
  for each row execute function public.set_updated_at();

-- ── Row Level Security (house pattern) ────────────────────────────────────────
alter table public.recommendations enable row level security;

drop policy if exists recommendations_select_self  on public.recommendations;
drop policy if exists recommendations_update_self  on public.recommendations;
drop policy if exists recommendations_select_admin on public.recommendations;

create policy recommendations_select_self  on public.recommendations
  for select using (auth.uid() = user_id);
create policy recommendations_update_self  on public.recommendations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy recommendations_select_admin on public.recommendations
  for select using (public.is_admin());

grant select, update on public.recommendations to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0021
-- ════════════════════════════════════════════════════════════════════════════
