/**
 * AIBOS — Server-only admin authorization (Node runtime).
 *
 * Resolves the current caller from the Supabase session cookie and decides
 * whether they are an admin (allowlist OR profiles.role='admin'). Use at the top
 * of every admin route handler via `requireAdmin()`.
 *
 * Do NOT import this from middleware (Edge) — it pulls in `next/headers`.
 */

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-server';
import { isAdminUser } from '@/lib/admin';
import type { User } from '@supabase/supabase-js';

export interface CallerAdmin {
  user: User | null;
  isAdmin: boolean;
}

/**
 * Admin is the ADMIN_EMAILS allowlist, and only that.
 *
 * `profiles.role = 'admin'` used to count too. Row-level security lets a
 * signed-in user insert their own profiles row, the guard trigger only pinned
 * role on UPDATE, and email sign-up is open, so anyone could create an account
 * and insert themselves as an admin. Migration 0033 pins inserts; until it has
 * run, and as defence in depth after, a value a user can write is not a key
 * to the admin panel. The allowlist lives in the server environment, which no
 * user can touch.
 */
export async function resolveCallerAdmin(): Promise<CallerAdmin> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, isAdmin: false };
  return { user, isAdmin: isAdminUser(user) };
}

/**
 * Guard for admin route handlers. Returns `{ user }` when authorized, or a ready
 * NextResponse (401/403) to return immediately when not.
 */
export async function requireAdmin(): Promise<
  { ok: true; user: User } | { ok: false; response: NextResponse }
> {
  const { user, isAdmin } = await resolveCallerAdmin();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }
  if (!isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, user };
}
