'use client';

// Keyboard focus for a panel that covers the page (WCAG 2.4.3, audit 19 Nov
// 2026). Talk, a worker's sheet and the welcome panels said aria-modal but
// let Tab walk out behind them, and on close focus fell to the top of the
// page, so a keyboard or screen reader owner lost their place every time.
//
// While `open`: focus moves into the panel (to `initial`, or the panel itself
// so its title is read out), Tab and Shift+Tab go round inside it, and on
// close focus goes back to whatever had it before.

import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

function inside(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
}

export function useModalFocus(
  panel: RefObject<HTMLElement>,
  open = true,
  initial?: RefObject<HTMLElement>,
): void {
  useEffect(() => {
    if (!open) return;
    const node = panel.current;
    if (!node) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');

    // After the first paint, so an entrance animation has the panel in place.
    const t = window.setTimeout(() => {
      if (node.contains(document.activeElement)) return;
      (initial?.current ?? node).focus({ preventScroll: true });
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = inside(node);
      if (!items.length) { e.preventDefault(); node.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === node || !node.contains(at))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !node.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      // Back to where the owner was, when that is still on the page and the
      // owner has not put focus somewhere else themselves (a click outside).
      const now = document.activeElement;
      const lost = !now || now === document.body || node.contains(now);
      if (lost && before && before !== document.body && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [open, panel, initial]);
}
