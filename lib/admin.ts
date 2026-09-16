/**
 * AIBOS — Admin identity helpers (PURE / runtime-agnostic)
 *
 * Admin is the ADMIN_EMAILS allowlist, for an address Google has proven the
 * account owns (isAdminUser). `profiles.role` is written for the database's
 * own policies but is never what the website trusts: a user could write it.
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

/** The parts of a Supabase auth user the admin check reads. */
interface AuthUserLike {
  email?: string | null;
  identities?: { provider?: string; identity_data?: { email?: unknown; email_verified?: unknown } | null }[] | null;
}

/**
 * An allowlisted address that Google has PROVEN this account owns.
 *
 * The address on the auth user is not proof on its own: email sign-up is
 * switched on with auto-confirm, which also confirms an email change at once,
 * so an allowlisted address nobody has registered yet could be claimed by
 * anyone. AIBOS signs people in with Google only, and Google only signs someone
 * in with an address it has checked, so a matching Google identity is the proof.
 */
export function isAdminUser(user?: AuthUserLike | null): boolean {
  const email = user?.email?.toLowerCase();
  if (!email || !isAdminEmail(email)) return false;
  return (user?.identities ?? []).some((i) =>
    i.provider === 'google'
    && String(i.identity_data?.email ?? '').toLowerCase() === email
    && i.identity_data?.email_verified !== false,
  );
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
