/**
 * AI-BOS — useAuth Hook
 * Manages session state, user data, and logout across the app.
 * Uses Supabase's onAuthStateChange for real-time session sync.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import { useStore } from '@/lib/store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user:        User | null;
  session:     Session | null;
  loading:     boolean;
  initialized: boolean;
}

interface UseAuthReturn extends AuthState {
  logout:         () => Promise<void>;
  refreshSession: () => Promise<void>;
  isAuthenticated: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const router   = useRouter();
  const supabase = createClient();

  const [state, setState] = useState<AuthState>({
    user:        null,
    session:     null,
    loading:     true,
    initialized: false,
  });

  // ── Initial session load ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[AI-BOS useAuth] getSession error:', error);
        }

        if (mounted) {
          setState({
            user:        session?.user ?? null,
            session:     session,
            loading:     false,
            initialized: true,
          });
        }
      } catch (err) {
        console.error('[AI-BOS useAuth] unexpected error:', err);
        if (mounted) {
          setState(prev => ({ ...prev, loading: false, initialized: true }));
        }
      }
    }

    loadSession();
    return () => { mounted = false; };
  }, [supabase]);

  // ── Real-time auth state listener ────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState(prev => ({
          ...prev,
          user:    session?.user ?? null,
          session: session,
          loading: false,
        }));

        // Handle specific events
        switch (event) {
          case 'SIGNED_IN':
            // Handled by callback route
            break;

          case 'SIGNED_OUT':
            // Wipe this browser's cached tenant data so the next account on the
            // same device never inherits the previous account's cabinet/tier.
            useStore.getState().clearTenant();
            router.push('/login');
            break;

          case 'TOKEN_REFRESHED':
            // Session silently refreshed — no action needed
            break;

          case 'USER_UPDATED':
            // User metadata updated
            break;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[AI-BOS useAuth] logout error:', error);
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    // State will be cleared by onAuthStateChange → SIGNED_OUT
  }, [supabase]);

  // ── Refresh session ───────────────────────────────────────────────────────
  const refreshSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.refreshSession();

    if (error) {
      console.error('[AI-BOS useAuth] refresh error:', error);
      return;
    }

    setState(prev => ({
      ...prev,
      session,
      user: session?.user ?? null,
    }));
  }, [supabase]);

  return {
    ...state,
    logout,
    refreshSession,
    isAuthenticated: !!state.session,
  };
}
