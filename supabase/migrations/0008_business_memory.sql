-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Business Memory  (migration 0008)   ·   Evolution Initiatives 8 & 13
-- ────────────────────────────────────────────────────────────────────────────
-- Every correction becomes reusable intelligence (Bible 8th Law: nothing entered
-- twice). A learned mapping is keyed by (user_id, kind, key) and reinforced each
-- time it's seen (`hits`). The pipeline consults this in normalize() so future
-- inputs auto-improve. Integrates with the AI layer — NOT a standalone service.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Tenant = user_id (ADR-001). Reuses set_updated_at()
-- and is_admin(). Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.business_memory (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,          -- 'alias' | 'category_for_party' | 'type_for_keyword'
                                       -- | 'tax_map' | 'excel_mapping' | 'ocr_correction' | ...
  key         text not null,          -- normalized observed token (lowercased)
  value       jsonb not null default '{}'::jsonb,  -- the canonical mapping/correction
  hits        integer not null default 1,          -- reinforcement count
  confidence  numeric not null default 0.5,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One learned value per (tenant, kind, key); re-learning reinforces it.
create unique index if not exists business_memory_uniq
  on public.business_memory(user_id, kind, key);
create index if not exists business_memory_lookup_idx
  on public.business_memory(user_id, kind);

drop trigger if exists business_memory_set_updated_at on public.business_memory;
create trigger business_memory_set_updated_at
  before update on public.business_memory
  for each row execute function public.set_updated_at();

alter table public.business_memory enable row level security;

drop policy if exists business_memory_select_self  on public.business_memory;
drop policy if exists business_memory_select_admin on public.business_memory;
-- Reads self-scoped; all WRITES go through the backend (service role) so memory is
-- only ever written by the pipeline, never set by hand from a client.
create policy business_memory_select_self  on public.business_memory
  for select using (auth.uid() = user_id);
create policy business_memory_select_admin on public.business_memory
  for select using (public.is_admin());

grant select on public.business_memory to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0008
-- ════════════════════════════════════════════════════════════════════════════
