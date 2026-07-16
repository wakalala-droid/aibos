/**
 * AIBOS — Supabase Browser Client
 * Only the browser singleton lives here.
 * Safe to import from client components ('use client').
 */

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton — one instance per browser tab
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

// Minimal no-op stub used during SSR / static prerender, where there is no
// browser and createBrowserClient would otherwise throw on missing env. The
// real client is always created in the browser (where env is inlined), so this
// only affects the prerendered HTML shell — auth state resolves after hydration.
const SSR_STUB = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    refreshSession: async () => ({ data: { session: null }, error: null }),
  },
};

export function createClient() {
  if (browserClient) return browserClient;

  // No window (SSR/prerender) or misconfigured env → return the safe stub.
  if (typeof window === 'undefined' || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return SSR_STUB as unknown as ReturnType<typeof createBrowserClient>;
  }

  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return browserClient;
}
