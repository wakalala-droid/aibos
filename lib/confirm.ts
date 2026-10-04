// confirmSheet(): the product's own "are you sure?" (UI/UX audit 2026-10 B2).
//
// Replaces window.confirm, which showed tiny system text headed
// "ai-bos.website says", looked like a scam warning on Android and could not
// show an amount clearly. Used for actions that move money, reach a customer or
// cannot come back. The sheet itself lives in components/ui/ConfirmSheet.tsx,
// mounted once in the root layout; this file is the promise-returning call.

export interface ConfirmRequest {
  /** The question, in owner words: "Cancel Mandela's stay?" */
  title: string;
  /** What will happen, with the amount: "K6,000 comes out of your books." */
  body?: string;
  /** The button that goes ahead: "Cancel the stay". */
  confirmLabel: string;
  /** The button that backs out. Defaults to "Keep it". */
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  /** Show a read-only text (a link to copy) instead of asking a question. */
  copyText?: string;
}

type Listener = (req: ConfirmRequest, resolve: (ok: boolean) => void) => void;
let listener: Listener | null = null;

/** Called by the mounted sheet. */
export function registerConfirmSheet(fn: Listener | null): void {
  listener = fn;
}

export function confirmSheet(req: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      // The sheet is always mounted in the root layout; this is a last resort.
      resolve(window.confirm([req.title, req.body].filter(Boolean).join('\n\n')));
      return;
    }
    listener(req, resolve);
  });
}

/** Show a link to copy by hand (when the browser blocks the clipboard). */
export function showCopyText(title: string, text: string): Promise<boolean> {
  return confirmSheet({ title, copyText: text, confirmLabel: 'Done', cancelLabel: '' });
}
