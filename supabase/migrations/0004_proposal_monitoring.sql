-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Migration 0004: Monitoring & Evaluation for function proposals
-- (SAFEGUARD.md — Layer 3). Raises the guard: approval no longer makes a metric
-- final. An approved metric enters a 15-day MONITORING window during which it is
-- re-critiqued on every use; only after the window passes with zero failures can
-- it be promoted to 'stable'. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.function_proposals
  add column if not exists monitor_until     timestamptz,
  add column if not exists monitor_runs      int not null default 0,
  add column if not exists monitor_fails     int not null default 0,
  add column if not exists last_monitored_at timestamptz;

-- status vocabulary is now:
--   proposed | rejected | monitoring | stable | implemented
-- (free text — no enum change needed; documented here for clarity)

create index if not exists function_proposals_monitor_idx
  on public.function_proposals(status, monitor_until);

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0004
-- ════════════════════════════════════════════════════════════════════════════
