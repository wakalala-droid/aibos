/**
 * AIBOS — Admin identity helpers (PURE / runtime-agnostic)
 *
 * Admin is identified by an email allowlist (bootstrap) OR a durable
 * `profiles.role = 'admin'` row. The allowlist lets the first admin work before
 * any row exists; the role is the lasting source of truth.
 *
 * This module is dependency-free on purpose so it can be imported from the Edge
 * `middleware.ts`. The session-based check that needs `next/headers` lives in
 * `lib/admin-server.ts` (Node runtime only).
 */

import type { Tier } from '@/lib/tiers';

/** Comma-separated allowlist, seeded with the owner. Server env only. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? 'vwanheda@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the email is in the bootstrap allowlist. */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

// ── Shared shapes for the admin API ↔ UI (types are erased at build) ──────────

/** One row of `admin_account_overview` (GET /api/admin/accounts). */
export interface AccountOverview {
  id: string;
  email: string | null;
  business_name: string | null;
  business_type: string | null;
  role: string;
  tier: Tier;
  tier_source: string | null;
  tier_granted_by: string | null;
  tier_granted_at: string | null;
  logo_url: string | null;
  created_at: string | null;
  last_active_at: string | null;
  uploads: number;
  chats: number;
  events: number;
  last_event_at: string | null;
}

export interface UsageEventRow {
  id: number;
  user_id: string;
  event: string;
  engine: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AdminAuditRow {
  id: number;
  admin_email: string;
  target_user_id: string | null;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface UsageAggregate {
  totalAccounts: number;
  activeAccounts30: number;
  uploads7: number;
  uploads30: number;
  chats7: number;
  chats30: number;
  series: { date: string; uploads: number; chats: number; total: number }[];
  topAccounts: { user_id: string; business_name: string | null; email: string | null; events: number }[];
  /** Activation funnel (audit #14): distinct accounts reaching each stage, all-time. */
  funnel: {
    signups: number;            // profiles rows
    onboarded: number;          // profiles.onboarded_at set
    recordedData: number;       // ≥1 'event_recorded' or 'upload' usage event
    sawInsight: number;         // ≥1 'engine_view' or 'brief_viewed'
    habitFormed: number;        // recorded on ≥3 distinct days within 7d of first recording
    habitEligible: number;      // first recording >7 days ago (denominator for habitFormed)
    trackedSince: string;       // 'event_recorded' instrumentation start date
  };
}
