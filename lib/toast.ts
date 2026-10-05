// Toasts and Undo (UI/UX audit 2026-10, B1 and C2).
//
// `notify` is a short confirmation ("Saved"). `undoable` is for the everyday
// removals: the row disappears at once, a toast offers Undo for 5 seconds, and
// only then is the removal sent to the server. There is no "un-remove" route on
// the API, so waiting is what makes Undo honest: if the page closes before the
// 5 seconds are up, nothing was removed, which fails safe.
//
// Money and customer actions do NOT use this; they ask first with
// confirmSheet() (lib/confirm.ts), because a delayed send could look done on a
// slow connection while a guest or customer is still waiting on it.

import { createElement } from 'react';
import { toast } from 'sonner';
import { CircleCheck, RotateCcw, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react';

/** The splash's round icon (the owner, 5 Oct 2026), for the front of a toast. */
function round(Icon: LucideIcon) {
  return createElement('span', { className: 'bento-icon toast-icon', 'aria-hidden': true }, createElement(Icon));
}

export function notify(message: string, kind: 'ok' | 'error' = 'ok'): void {
  if (kind === 'error') toast.error(message, { duration: 6000, icon: round(TriangleAlert) });
  else toast(message, { duration: 3500, icon: round(CircleCheck) });
}

export interface UndoableOptions {
  /** What just happened, in owner words: "Entry removed". */
  message: string;
  /** Sends the change to the server once the Undo window has passed. */
  run: () => Promise<unknown>;
  /** Put the row back on screen when the owner presses Undo. */
  onUndo?: () => void;
  /** Called after the server accepted the change (reload, refresh twin). */
  onDone?: () => void;
  /** Called if the server refused; the row should come back. */
  onError?: (e: Error) => void;
  delayMs?: number;
}

export function undoable(opts: UndoableOptions): void {
  const delay = opts.delayMs ?? 5000;
  let undone = false;
  toast(opts.message, {
    duration: delay,
    icon: round(Trash2),
    action: {
      label: 'Undo',
      onClick: () => {
        undone = true;
        opts.onUndo?.();
        toast('Put back', { duration: 2500, icon: round(RotateCcw) });
      },
    },
  });
  window.setTimeout(async () => {
    if (undone) return;
    try {
      await opts.run();
      opts.onDone?.();
    } catch (e) {
      const err = e as Error;
      opts.onError?.(err);
      toast.error(err.message || 'That could not be saved. Nothing was changed.', { duration: 6000, icon: round(TriangleAlert) });
    }
  }, delay);
}
