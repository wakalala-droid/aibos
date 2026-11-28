// lib/guide/prefs.ts
// The sphere's settings (owner, 28 Nov 2026): the voice AI-BOS speaks in, the
// spoken report when they first open AI-BOS each day, and tips on new pages.
// Kept on the person's profile (aibos-api assistant_prefs.py, migration 0050)
// so they follow them to every device, and on this device too, so a choice
// still holds before the migration is run or while offline.

import { useEffect, useState } from 'react';
import { getAssistantPrefs, putAssistantPrefs, type AssistantPrefs, type VoiceChoice } from '@/lib/api';

const KEY = 'aibos-sphere-prefs-v1';
export const DEFAULT_PREFS: AssistantPrefs = { voice: 'Kore', spoken_report: false, tips: true, saved: false };
export const VOICES: VoiceChoice[] = [
  { name: 'Kore', sounds: 'Firm and clear' }, { name: 'Aoede', sounds: 'Warm and bright' },
  { name: 'Leda', sounds: 'Young and light' }, { name: 'Charon', sounds: 'Deep and calm' },
  { name: 'Orus', sounds: 'Steady and sure' }, { name: 'Puck', sounds: 'Upbeat' },
  { name: 'Fenrir', sounds: 'Lively' }, { name: 'Zephyr', sounds: 'Bright and easy' },
];

let current: AssistantPrefs = DEFAULT_PREFS;
let loaded: Promise<void> | null = null;
const listeners = new Set<(p: AssistantPrefs) => void>();

function local(): Partial<AssistantPrefs> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<AssistantPrefs>; } catch { return {}; }
}
function keep(p: AssistantPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify({ voice: p.voice, spoken_report: p.spoken_report, tips: p.tips })); } catch { /* private mode */ }
}
function tell() { for (const f of listeners) f(current); }

/** Read once per page load: the server's copy wins once it is saved there. */
export function loadPrefs(): Promise<void> {
  if (!loaded) {
    current = { ...DEFAULT_PREFS, ...local() };
    const mine = local();
    loaded = getAssistantPrefs()
      .then(async (p) => {
        if (p.saved) { current = { voice: p.voice, spoken_report: p.spoken_report, tips: p.tips, saved: true }; keep(current); return; }
        // Nothing on the account yet, but this device kept a choice (before
        // migration 0050, or offline): send it up once, so it follows them.
        if (Object.keys(mine).length) {
          const up = await putAssistantPrefs({ voice: current.voice, spoken_report: current.spoken_report, tips: current.tips });
          current = { ...current, saved: !!up.saved };
        }
      })
      .catch(() => { /* this device's copy stands */ })
      .finally(tell);
  }
  return loaded;
}

/** Change one or more settings. Resolves with a note when they could only be kept on this device. */
export async function savePrefs(changes: Partial<Omit<AssistantPrefs, 'saved'>>): Promise<string | null> {
  current = { ...current, ...changes };
  keep(current);
  tell();
  try {
    const p = await putAssistantPrefs(changes);
    current = { ...current, saved: !!p.saved };
    tell();
    return null;
  } catch {
    // Before migration 0050 (a 409) or offline: this device keeps it.
    current = { ...current, saved: false };
    tell();
    return 'Saved on this device for now.';
  }
}

export function getPrefs(): AssistantPrefs { return current; }

export function usePrefs(): AssistantPrefs {
  const [p, setP] = useState<AssistantPrefs>(current);
  useEffect(() => {
    listeners.add(setP);
    void loadPrefs();
    setP(current);
    return () => { listeners.delete(setP); };
  }, []);
  return p;
}
