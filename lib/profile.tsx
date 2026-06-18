'use client';

/**
 * AI-BOS — Profile provider + hook.
 *
 * Supabase is the source of truth for tier/identity; the Zustand store is a
 * cache. On a signed-in user this provider:
 *   1. idempotently provisions the user's `profiles` row (safety net alongside
 *      the OAuth callback),
 *   2. fetches the row,
 *   3. writes `tier` into the store via `setTier` so `canAccess` / `FeatureGate`
 *      keep working unchanged,
 *   4. logs a `login` usage event once per session.
 *
 * `useProfile()` is safe to call anywhere (returns a sensible default outside the
 * provider), so the header, profile page, sidebar and admin UI all share it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/lib/store';
import { logUsage } from '@/lib/usage';
import type { Tier } from '@/lib/tiers';

export type Role = 'member' | 'admin' | 'owner';

export interface Profile {
  id: string;
  email: string | null;
  role: Role;
  tier: Tier;
  business_name: string | null;
  business_type: string | null;
  industry: string | null;
  location: string | null;
  currency: string | null;
  phone: string | null;
  whatsapp: string | null;
  contact_email: string | null;
  logo_url: string | null;
  tier_source: string | null;
  tier_granted_at: string | null;
  created_at: string | null;
  last_active_at: string | null;
}

interface ProfileContextValue {
  profile: Profile | null;
  role: Role;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT: ProfileContextValue = {
  profile: null,
  role: 'member',
  isAdmin: false,
  loading: true,
  refresh: async () => {},
};

const ProfileContext = createContext<ProfileContextValue>(DEFAULT);

function normaliseTier(v: unknown): Tier {
  return v === 'pro' || v === 'growth' ? v : 'free';
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const setTier = useStore((s) => s.setTier);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const loggedLoginFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // 1. Provision (no-op if the row already exists; never overwrites real data).
    try {
      await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email }, { onConflict: 'id', ignoreDuplicates: true });
    } catch {
      /* non-fatal — the callback also provisions */
    }

    // 2. Fetch the authoritative row.
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      const p = data as unknown as Profile;
      setProfile(p);
      // 3. Cache tier into the store so the existing gate reflects reality.
      setTier(normaliseTier(p.tier));
    }
    setLoading(false);

    // 4. One login event per signed-in session.
    if (loggedLoginFor.current !== user.id) {
      loggedLoginFor.current = user.id;
      logUsage('login');
    }
  }, [user, setTier]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, isAuthenticated]);

  const role: Role = (profile?.role as Role) ?? 'member';
  const value: ProfileContextValue = {
    profile,
    role,
    isAdmin: role === 'admin',
    loading,
    refresh: load,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
