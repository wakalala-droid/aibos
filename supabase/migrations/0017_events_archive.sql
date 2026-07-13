-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Business Events Archive  (migration 0017)   ·   audit item #97
-- ────────────────────────────────────────────────────────────────────────────
-- "Start afresh" (/events/reset) was the one sanctioned hard-delete in the
-- spine. It stays a delete from the LIVE log — but the rows are copied here
-- first, so an intentional reset is recoverable for 30 days (the backend
-- purges a user's archive rows older than that on their next reset).
--
-- Columns mirror business_events exactly (dict-passthrough archive/restore in
-- nervous_system.reset_business), plus archived_at / archive_reason. Its own
-- surrogate PK: the same event id may legitimately appear twice after an
-- archive → restore → re-archive cycle.
--
-- IDEMPOTENT & NON-DESTRUCTIVE, same conventions as 0005. Run in the Supabase
-- SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.business_events_archive (
  archive_row_id bigint generated always as identity primary key,
  archived_at    timestamptz not null default now(),
  archive_reason text        not null default 'reset',

  -- ── mirror of public.business_events (0005) ─────────────────────────────
  id             uuid        not null,
  schema_version integer     not null default 1,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  business_id    uuid,
  event_type     text        not null,
  occurred_at    timestamptz not null,
  recorded_at    timestamptz not null,
  source         text        not null,
  confidence     numeric     not null,
  status         text        not null,
  payload        jsonb       not null default '{}'::jsonb,
  corrections    jsonb       not null default '{}'::jsonb,
  audit          jsonb       not null default '[]'::jsonb,
  created_by     uuid,
  reversed_by    uuid,
  created_at     timestamptz not null,
  updated_at     timestamptz not null
);

create index if not exists business_events_archive_user_idx
  on public.business_events_archive(user_id, archived_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Recovery is a support/backend act (service role bypasses RLS). Users and
-- admins may READ; nobody writes from the client.
alter table public.business_events_archive enable row level security;

drop policy if exists business_events_archive_select_self  on public.business_events_archive;
drop policy if exists business_events_archive_select_admin on public.business_events_archive;

create policy business_events_archive_select_self  on public.business_events_archive
  for select using (auth.uid() = user_id);
create policy business_events_archive_select_admin on public.business_events_archive
  for select using (public.is_admin());

grant select on public.business_events_archive to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0017
-- ════════════════════════════════════════════════════════════════════════════
