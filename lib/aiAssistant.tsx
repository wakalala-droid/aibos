'use client';

// lib/aiAssistant.tsx — shared context for the floating AI assistant.
//
// Provides two things to the whole dashboard:
//   1. open / explain state the FloatingAiAssistant subscribes to.
//   2. a GLOBAL long-press detector. Any element that carries a
//      `data-ai-explain="<id>"` attribute becomes "explainable": press and hold
//      it (~500ms) and the assistant opens and explains exactly that component.
//      Components opt in with two data attributes — no per-component wiring.

import React, {
  createContext, useContext, useState, useRef, useEffect, useCallback,
} from 'react';

export interface ExplainTarget {
  /** Knowledge-base id, e.g. "kpi.revenue". */
  id: string;
  /** Optional human label, used if the id has no knowledge entry. */
  label?: string;
  /** Optional live value text the element exposes via data-ai-value. */
  value?: string;
  /** Bumped each press so repeat long-presses re-trigger. */
  ts: number;
}

interface AiAssistantCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  explainTarget: ExplainTarget | null;
  clearExplain: () => void;
  /** Open the panel and seed a question (used by quick actions). */
  pendingAsk: string | null;
  ask: (q: string) => void;
  clearAsk: () => void;
}

const Ctx = createContext<AiAssistantCtx | null>(null);

export function useAiAssistant(): AiAssistantCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAiAssistant must be used within <AiAssistantProvider>');
  return ctx;
}

const HOLD_MS = 480;       // press duration to trigger an explanation
const MOVE_CANCEL = 12;    // px of movement that cancels a hold (it's a scroll/drag)

export function AiAssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);

  const setOpen = useCallback((v: boolean) => setOpenState(v), []);
  const toggle = useCallback(() => setOpenState((v) => !v), []);
  const clearExplain = useCallback(() => setExplainTarget(null), []);
  const ask = useCallback((q: string) => { setPendingAsk(q); setOpenState(true); }, []);
  const clearAsk = useCallback(() => setPendingAsk(null), []);

  // ── Global long-press detection ───────────────────────────────────────────
  // Mutable refs so the document listeners never need re-binding.
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const firedRef = useRef(false);
  const restoreRef = useRef<{ boxShadow: string; transition: string; transform: string } | null>(null);

  useEffect(() => {
    const cancelHold = (didFire: boolean) => {
      if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
      const el = elRef.current;
      if (el && restoreRef.current) {
        // Restore the element's original look (after a tick so a fired hold's
        // "release" reads as intentional, not a flicker).
        el.style.boxShadow = restoreRef.current.boxShadow;
        el.style.transform = restoreRef.current.transform;
        window.setTimeout(() => {
          if (el) el.style.transition = restoreRef.current?.transition ?? '';
        }, 180);
      }
      elRef.current = null;
      startRef.current = null;
      restoreRef.current = null;
      if (!didFire) firedRef.current = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      // Ignore secondary buttons; only primary press should arm a hold.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-ai-explain]');
      if (!target) return;

      firedRef.current = false;
      elRef.current = target;
      startRef.current = { x: e.clientX, y: e.clientY };
      restoreRef.current = {
        boxShadow: target.style.boxShadow,
        transition: target.style.transition,
        transform: target.style.transform,
      };

      // "Charging" affordance — a cyan ring grows in over the hold window.
      target.style.transition = `box-shadow ${HOLD_MS}ms ease-out, transform ${HOLD_MS}ms ease-out`;
      target.style.boxShadow = '0 0 0 2px var(--cyan), 0 0 28px color-mix(in srgb, var(--cyan) 45%, transparent)';
      target.style.transform = 'scale(0.985)';

      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        const id = target.getAttribute('data-ai-explain') || '';
        const label = target.getAttribute('data-ai-label') || undefined;
        const value = target.getAttribute('data-ai-value') || undefined;
        if (id) {
          setExplainTarget({ id, label, value, ts: Date.now() });
          setOpenState(true);
          // Haptic nudge on supported devices.
          try { navigator.vibrate?.(18); } catch { /* noop */ }
        }
        cancelHold(true);
      }, HOLD_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (dx * dx + dy * dy > MOVE_CANCEL * MOVE_CANCEL) cancelHold(false);
    };

    const onPointerUp = () => { if (timerRef.current !== null) cancelHold(false); };

    // Swallow the click that follows a successful hold (so long-pressing a card
    // that is also a link doesn't navigate).
    const onClickCapture = (e: MouseEvent) => {
      if (firedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        firedRef.current = false;
      }
    };
    // Suppress the native context menu / text callout while a hold is arming.
    const onContextMenu = (e: MouseEvent) => { if (elRef.current) e.preventDefault(); };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('scroll', onPointerUp, true);
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('scroll', onPointerUp, true);
      document.removeEventListener('click', onClickCapture, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Ctx.Provider value={{ open, setOpen, toggle, explainTarget, clearExplain, pendingAsk, ask, clearAsk }}>
      {children}
    </Ctx.Provider>
  );
}
