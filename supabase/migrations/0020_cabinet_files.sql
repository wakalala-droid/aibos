-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Cabinet files metadata  (migration 0020)  ·  audit item #10
-- ────────────────────────────────────────────────────────────────────────────
-- Kills the worst trust bug in the product: uploaded analyses lived only in a
-- process dict and vanished on every Railway deploy. Metadata lives here for
-- cheap listing; the payload (df_json + analysis, tens of MB) lives in the
-- PRIVATE Storage bucket `cabinet` as {user_id}/{cabinet_id}.json.
--
-- ⚠ MANUAL STEP BESIDE THIS SQL: Supabase → Storage → New bucket →
--   name `cabinet`, PRIVATE (no public access). The service-role backend is
--   the only writer/reader; no storage policies for anon/authenticated needed.
--
-- IDEMPOTENT & NON-DESTRUCTIVE, house conventions.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.cabinet_files (
  id           text primary key,                    -- cabinet_id (uuid string from the API)
  user_id      uuid        not null references auth.users(id) on delete cascade,

  name         text,                                -- original filename
  file_type    text,
  engine       text,                                -- engine1|engine2|engine3
  active_sheet text,
  sheets       jsonb       not null default '[]'::jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists cabinet_files_user_idx on public.cabinet_files(user_id, created_at desc);

drop trigger if exists cabinet_files_set_updated_at on public.cabinet_files;
create trigger cabinet_files_set_updated_at
  before update on public.cabinet_files
  for each row execute function public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- The service-role backend does all writes; users may read their own rows
-- (harmless, consistent with the house pattern), admins may read all.
alter table public.cabinet_files enable row level security;

drop policy if exists cabinet_files_select_self  on public.cabinet_files;
drop policy if exists cabinet_files_select_admin on public.cabinet_files;

create policy cabinet_files_select_self  on public.cabinet_files
  for select using (auth.uid() = user_id);
create policy cabinet_files_select_admin on public.cabinet_files
  for select using (public.is_admin());

grant select on public.cabinet_files to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0020
-- ════════════════════════════════════════════════════════════════════════════
