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
  /** Morning Brief delivery preferences (migration 0013). */
  brief_email_enabled?: boolean | null;
  whatsapp_number?: string | null;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const loggedLoginFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Tenant-safety: if the persisted store belonged to a different account
    // (shared browser, or a stale cache from before logout cleared it), wipe it
    // before showing anything so this user never sees another's cabinet/tier.
    useStore.getState().bindUser(user.id);

    // Resolve the row server-side: RLS on the existing `profiles` table blocks
    // the browser's self-select (role comes back null), so reading directly here
    // would never see role/tier. `/api/profile` provisions + reads with the
    // service role and returns the authoritative `isAdmin` verdict.
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      if (res.ok) {
        const { profile: p, isAdmin: admin } = (await res.json()) as {
          profile: Profile | null;
          isAdmin: boolean;
        };
        if (p) {
          setProfile(p);
          // Cache tier into the store so the existing gate reflects reality.
          setTier(normaliseTier(p.tier));
        }
        setIsAdmin(Boolean(admin));
      }
    } catch {
      /* non-fatal — keep defaults so the dashboard still renders */
    }
    setLoading(false);

    // One login event per signed-in session.
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
    isAdmin,
    loading,
    refresh: load,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
