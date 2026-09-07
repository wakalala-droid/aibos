'use client';

/**
 * AIBOS — Profile provider + hook.
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
import { authHeaders } from '@/lib/api';
import { isTier, type Tier } from '@/lib/tiers';

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
  /** The plan whose welcome this account has already closed (migration 0028).
   *  A tier rather than a flag, so a second upgrade gets its own welcome. */
  welcome_seen_tier?: string | null;
}

/** Team membership role (audit #27/#28) — distinct from the admin `Role`.
 *  Everyone is 'owner' of their own tenant until an owner invites them. */
export type TeamRole = 'owner' | 'staff' | 'accountant';

/** What the API says it will honour for this account — the tiebreaker.
 *  See aibos-api GET /me/entitlements. */
interface Entitlements {
  tier: Tier;
  reason: 'ok' | 'provisioned' | 'unreadable';
  plan_readable: boolean;
  features: string[];
  note: string;
}

interface ProfileContextValue {
  profile: Profile | null;
  role: Role;
  isAdmin: boolean;
  /** Team role in the tenant the user is acting in. */
  teamRole: TeamRole;
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * False when the API could not establish which plan this account is on.
   * Not the same as being on Free: the interface is running on a remembered
   * answer, so some things will refuse even though the plan allows them.
   */
  planConfirmed: boolean;
  /** Plain-language explanation when planConfirmed is false. */
  planNote: string;
  /** The plan the API will actually enforce, when it could say. */
  serverTier: Tier | null;
}

const DEFAULT: ProfileContextValue = {
  profile: null,
  role: 'member',
  isAdmin: false,
  teamRole: 'owner',
  loading: true,
  refresh: async () => {},
  planConfirmed: true,
  planNote: '',
  serverTier: null,
};

const ProfileContext = createContext<ProfileContextValue>(DEFAULT);

/**
 * Validate `profiles.tier` against the ladder in tiers.ts — never a hand-written
 * list. This function used to spell out 'pro' and 'growth' and fall through to
 * 'free' for anything else, so when Pro+ was added it silently DOWNGRADED every
 * proplus customer to Free on page load: checkout cached the right tier, then
 * the first refresh wiped it, the whole UI locked, and the API kept honouring
 * Pro+ (entitlements.py reads profiles.tier straight from the row).
 */
function normaliseTier(v: unknown): Tier {
  return isTier(v) ? v : 'free';
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const setTier = useStore((s) => s.setTier);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teamRole, setTeamRole] = useState<TeamRole>('owner');
  const [loading, setLoading] = useState(true);
  const [planConfirmed, setPlanConfirmed] = useState(true);
  const [planNote, setPlanNote] = useState('');
  const [serverTier, setServerTier] = useState<Tier | null>(null);
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
    let rowTier: Tier | null = null;
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      if (res.ok) {
        const { profile: p, isAdmin: admin } = (await res.json()) as {
          profile: Profile | null;
          isAdmin: boolean;
        };
        if (p) {
          setProfile(p);
          rowTier = normaliseTier(p.tier);
        }
        setIsAdmin(Boolean(admin));
      }
    } catch {
      /* non-fatal — keep defaults so the dashboard still renders */
    }

    // ── Which plan does the API actually enforce? ────────────────────────────
    // The store's `tier` is a cache that outlives a logout and even a rebuilt
    // database, and the gate in front of every paid screen reads it. So the
    // browser can show a paid surface while the API answers "upgrade" to every
    // call behind it — which is exactly what a Growth owner hit on Hospitality.
    //
    // The API is what enforces, so the API's answer wins whenever it HAS one.
    // When it doesn't, we keep what we had rather than demoting a paying
    // customer over one failed request, and say plainly that we could not check.
    let server: Entitlements | null = null;
    try {
      const r = await fetch('/api/proxy/me/entitlements', {
        headers: await authHeaders(),
        cache: 'no-store',
      });
      if (r.ok) server = (await r.json()) as Entitlements;
    } catch { /* offline / API asleep — handled below */ }

    if (server && server.plan_readable && isTier(server.tier)) {
      setServerTier(server.tier);
      setTier(server.tier);
      setPlanConfirmed(true);
      setPlanNote(
        rowTier && rowTier !== server.tier
          ? `Your account record says ${rowTier}, but the app is granting ${server.tier}. ` +
            'Sign out and back in; if it stays this way it needs looking at.'
          : '',
      );
    } else {
      setServerTier(null);
      setPlanConfirmed(false);
      setPlanNote(
        server?.note ||
        'We could not check which plan this account is on, so the app is using ' +
        'the last answer it had. Some things may refuse even though your plan ' +
        'allows them. This is a fault on our side, not a change to your plan.',
      );
      if (rowTier) setTier(rowTier);
    }

    setLoading(false);

    // Team membership (audit #27/#28): accept any pending invites for this
    // account, then resolve the role we're acting in. Best-effort — a plain
    // owner (no membership) stays 'owner' and nothing changes.
    try {
      await fetch('/api/proxy/members/accept', { method: 'POST', headers: await authHeaders() }).catch(() => {});
      const meRes = await fetch('/api/proxy/members/me', { headers: await authHeaders() });
      if (meRes.ok) {
        const me = (await meRes.json()) as { role?: TeamRole };
        setTeamRole(me.role === 'staff' || me.role === 'accountant' ? me.role : 'owner');
      }
    } catch { /* non-fatal — default to owner */ }

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
    teamRole,
    loading,
    refresh: load,
    planConfirmed,
    planNote,
    serverTier,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
