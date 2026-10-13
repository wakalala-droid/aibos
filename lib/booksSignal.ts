// lib/booksSignal.ts — one signal for "the books changed", heard everywhere.
//
// Money reaches the books from many pages: Record, Invoices, Rooms & Stays,
// Staff, the Schedule, Stock, an import, the assistant. Only some of them
// told the rest of the app, so after marking an invoice paid the money figure
// on Home stayed where it was until a reload, and a payment that arrived by
// mobile money while the app was open never showed at all.
//
// Now every successful change to the books (any write through lib/api.ts or
// lib/hospitality.ts) announces itself here. The dashboard counts the books
// again (store.refreshTwin) and every card that reads its own figures
// (keyed on the store's booksVersion) reads them again. Other open tabs hear
// it too, and a tab coming back into view catches up (app/dashboard/layout).

const EVENT = 'aibos:books-changed';

/** Writes that change nothing in the books: a preview, a guess, a setting. */
const QUIET: RegExp[] = [
  /^\/events\/classify/, /^\/events\/excel\/preview/, /^\/documents\/scan/, /^\/ingest\//,
  /^\/transcribe/, /^\/simulate/, /^\/recommendations\//, /^\/memory\//, /^\/push\//,
  /^\/announce/, /^\/card-reminder/, /^\/members/, /^\/payments\/account/, /^\/profile/,
  /^\/latest-analysis/, /^\/payroll\/preview/, /^\/hospitality\/properties\/[^/]+\/guest-emails/,
];

let timer: ReturnType<typeof setTimeout> | null = null;
let channel: BroadcastChannel | null | undefined;

function otherTabs(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  try {
    channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('aibos-books');
  } catch {
    channel = null;
  }
  return channel;
}

/** Say the books changed (after a write to `path`). A burst of writes is one signal. */
export function booksChanged(path?: string): void {
  if (typeof window === 'undefined') return;
  if (path && QUIET.some((rx) => rx.test(path))) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    window.dispatchEvent(new Event(EVENT));
    try { otherTabs()?.postMessage('changed'); } catch { /* the other tabs catch up when they are opened */ }
  }, 250);
}

/** Hear the books change, in this tab or another. Returns the unsubscribe. */
export function onBooksChanged(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const tab = otherTabs();
  const onMessage = () => fn();
  window.addEventListener(EVENT, fn);
  tab?.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener(EVENT, fn);
    tab?.removeEventListener('message', onMessage);
  };
}
