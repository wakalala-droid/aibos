-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Migration 0003: function_proposals (SAFEGUARD.md — Layer 2)
--
-- The owner-only review queue for AI/rule-proposed derived-metric functions.
-- Proposals are DATA (a validated formula + sandbox preview + critique verdict);
-- nothing here executes. Only admins can read/write. Run in the SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.function_proposals (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  purpose       text,
  extends_engine text,
  inputs        jsonb not null default '[]',
  formula       text not null,
  preview       jsonb not null default '{}',
  confidence    numeric not null default 0,
  citations     jsonb not null default '[]',
  assumptions   jsonb not null default '[]',
  risks         jsonb not null default '[]',
  critique      jsonb not null default '{}',
  source        text not null default 'rule',   -- 'rule' | 'ai'
  status        text not null default 'proposed', -- proposed|approved|rejected|implemented
  source_file   text,
  created_by    text,
  created_at    timestamptz not null default now(),
  reviewed_by   text,
  reviewed_at   timestamptz
);

create index if not exists function_proposals_status_idx  on public.function_proposals(status);
create index if not exists function_proposals_created_idx on public.function_proposals(created_at desc);

alter table public.function_proposals enable row level security;

-- Admin-only (is_admin() is SECURITY DEFINER — no recursion). Writes also happen
-- via the service-role admin route, which bypasses RLS.
drop policy if exists function_proposals_admin_all on public.function_proposals;
create policy function_proposals_admin_all
  on public.function_proposals for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.function_proposals to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0003
-- ════════════════════════════════════════════════════════════════════════════
