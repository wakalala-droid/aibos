/**
 * AIBOS — Supabase Service-Role Client (SERVER ONLY)
 *
 * This client uses the `service_role` key, which BYPASSES Row Level Security.
 * It must NEVER be imported from a 'use client' component or shipped to the
 * browser. Use it only inside Node-runtime route handlers under app/api/admin/*
 * to perform admin-verified, cross-account writes.
 *
 * IMPORTANT: `SUPABASE_SERVICE_ROLE_KEY` is the real `service_role` key from
 * Supabase → Project Settings → API. It is NOT the anon key. There is no key
 * hardcoded here — it is read from server env only.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let serviceClient: SupabaseClient | null = null;

/**
 * Returns a singleton service-role client. Throws a clear error if the env is
 * missing so misconfiguration fails loudly in the route (→ 500) rather than
 * silently editing nothing.
 */
export function createServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase service-role client is not configured. Set SUPABASE_SERVICE_ROLE_KEY ' +
        '(the service_role key from Supabase → Project Settings → API) in the server env.'
    );
  }

  serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return serviceClient;
}
