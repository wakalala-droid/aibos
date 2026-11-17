'use client';

// lib/autoMode.ts
// AIBOS auto (17 Nov 2026): one shared state for the switch at the top of
// every page and the team scene on Home, so flipping it in one
// place shows everywhere at once. The API decides what auto may do
// (aibos-api actions.AUTO_*): the safe jobs do themselves with an Undo, and
// anything that goes to another person or moves money still waits for a yes.

import { useEffect } from 'react';
import { create } from 'zustand';
import { ApiError, getAuto, setAuto, type AutoState } from '@/lib/api';

interface AutoStore {
  state: AutoState | null;
  busy: boolean;
  error: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  set: (on: boolean) => Promise<boolean>;
}

const useAutoStore = create<AutoStore>((set, get) => ({
  state: null,
  busy: false,
  error: null,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    try { set({ state: await getAuto() }); }
    catch { set({ state: null }); }           // staff, signed out, offline: no switch
  },
  set: async (on: boolean) => {
    set({ busy: true, error: null });
    try {
      const state = await setAuto(on);
      set({ state, busy: false });
      teamChanged();
      return true;
    } catch (e) {
      set({ busy: false, error: e instanceof ApiError ? e.message : 'AIBOS could not switch just now. Try again in a moment.' });
      return false;
    }
  },
}));

/** The team's work changed (a check, an answer, auto switched): Needs you
 *  and the team scene on Home read again. */
export const TEAM_EVENT = 'aibos:team';
export function teamChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TEAM_EVENT));
}

/** Read again whenever the team's work changes. */
export function useOnTeamChange(fn: () => void): void {
  useEffect(() => {
    window.addEventListener(TEAM_EVENT, fn);
    return () => window.removeEventListener(TEAM_EVENT, fn);
  }, [fn]);
}

export function useAutoMode() {
  const s = useAutoStore();
  const load = s.load;
  useEffect(() => { void load(); }, [load]);
  return {
    state: s.state,
    on: !!s.state?.on,
    available: !!s.state?.available,
    busy: s.busy,
    error: s.error,
    setOn: s.set,
  };
}
