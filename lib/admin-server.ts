/**
 * AI-BOS — Server-only admin authorization (Node runtime).
 *
 * Resolves the current caller from the Supabase session cookie and decides
 * whether they are an admin (allowlist OR profiles.role='admin'). Use at the top
 * of every admin route handler via `requireAdmin()`.
 *
 * Do NOT import this from middleware (Edge) — it pulls in `next/headers`.
 */

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import type { User } from '@supabase/supabase-js';

export interface CallerAdmin {
  user: User | null;
  isAdmin: boolean;
}

/**
 * Read the role with the caller's own session client (RLS permits reading your
 * own row), so authorization itself doesn't need the service-role key.
 */
export async function resolveCallerAdmin(): Promise<CallerAdmin> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, isAdmin: false };
  if (isAdminEmail(user.email)) return { user, isAdmin: true };

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return { user, isAdmin: (data?.role as string | undefined) === 'admin' };
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
