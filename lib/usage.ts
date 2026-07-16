'use client';

/**
 * AIBOS — Usage instrumentation (client, fire-and-forget)
 *
 * logUsage() appends a row to `usage_events` using the caller's own browser
 * Supabase client (RLS lets a user insert their own events). It NEVER throws and
 * NEVER blocks the UI — every failure is swallowed. It also bumps
 * `profiles.last_active_at`, throttled to at most once every 5 minutes.
 */

import { createClient } from '@/lib/supabase';

// Funnel events (audit item #14): 'onboarding_completed' fires once at wizard
// finish, 'event_recorded' at every recording action (posted OR queued offline
// — it measures the habit, not persistence), 'brief_viewed' on the brief page.
export type UsageEvent =
  | 'login' | 'upload' | 'chat' | 'engine_view' | 'page_view'
  | 'onboarding_completed' | 'event_recorded' | 'brief_viewed';
export type UsageEngine = 'engine1' | 'engine2' | 'engine3' | 'cross';

interface LogOptions {
  engine?: UsageEngine;
  meta?: Record<string, unknown>;
}

const ACTIVE_BUMP_MS = 5 * 60_000;
let lastActiveBump = 0;

export function logUsage(event: UsageEvent, opts: LogOptions = {}): void {
  if (typeof window === 'undefined') return;

  // Detached, non-blocking, error-swallowing.
  void (async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('usage_events').insert({
        user_id: user.id,
        event,
        engine: opts.engine ?? null,
        meta: opts.meta ?? {},
      });

      const now = Date.now();
      if (now - lastActiveBump > ACTIVE_BUMP_MS) {
        lastActiveBump = now;
        await supabase
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', user.id);
      }
    } catch {
      /* usage tracking must never affect the app */
    }
  })();
}
