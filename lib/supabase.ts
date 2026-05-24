/**
 * AI-BOS — Supabase Browser Client
 * Only the browser singleton lives here.
 * Safe to import from client components ('use client').
 */

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton — one instance per browser tab
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return browserClient;
}
