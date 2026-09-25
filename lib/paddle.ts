/**
 * AIBOS: the card checkout, through Paddle.
 *
 * Paddle sells card plans as Merchant of Record, so the card form is theirs:
 * Paddle.js draws it in a secure frame and nothing about the card ever
 * touches AIBOS. What we decide, we decide on the server: the API
 * makes the Paddle transaction (price, and whose account it pays for) and
 * the browser only opens it by its id.
 *
 * The checkout page embeds the form in the page itself (mountInlineCheckout),
 * like a Stripe or Linear checkout, rather than opening a pop-up over it.
 *
 * The plan is switched on by Paddle's signed webhook to the API, never by this
 * page. After Paddle says "completed" the checkout waits for the API to agree
 * before it says "Welcome to Pro".
 *
 * The same script also serves Paddle's own links (a card update, a payment
 * link in an email): those arrive as ?_ptxn=txn_... on the page Paddle calls
 * the default payment link, and Paddle.js opens them by itself.
 */

const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';

export type PaddleEventName =
  | 'checkout.loaded'
  | 'checkout.closed'
  | 'checkout.completed'
  | 'checkout.error'
  | 'checkout.payment.failed'
  | string;

export interface PaddleEvent {
  name?: PaddleEventName;
  data?: Record<string, unknown>;
}

interface PaddleGlobal {
  Environment: { set: (env: 'sandbox' | 'production') => void };
  Initialize: (opts: { token: string; eventCallback?: (e: PaddleEvent) => void }) => void;
  Update?: (opts: { eventCallback?: (e: PaddleEvent) => void }) => void;
  Initialized?: boolean;
  Checkout: {
    open: (opts: Record<string, unknown>) => void;
    close: () => void;
  };
}

declare global {
  interface Window { Paddle?: PaddleGlobal }
}

let loading: Promise<PaddleGlobal> | null = null;
let listener: ((e: PaddleEvent) => void) | null = null;
let initialised: string | null = null;

function loadScript(): Promise<PaddleGlobal> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Paddle runs in the browser only.'));
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (loading) return loading;
  loading = new Promise<PaddleGlobal>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PADDLE_JS;
    s.async = true;
    s.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error('The card checkout did not load.')));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error('The card checkout could not be loaded. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Load and start Paddle.js once. `environment` is the API's word for the
 * account ('sandbox' | 'live'); the token is public by design.
 */
export async function ensurePaddle(token: string, environment: string | null | undefined): Promise<PaddleGlobal> {
  const paddle = await loadScript();
  const key = `${environment}|${token}`;
  if (initialised !== key) {
    if (initialised === null) {
      if (environment === 'sandbox') paddle.Environment.set('sandbox');
      paddle.Initialize({ token, eventCallback: (e) => listener?.(e) });
    }
    initialised = key;
  }
  return paddle;
}

/** Route Paddle's checkout events to whoever opened the checkout last. */
export function onPaddleEvent(fn: ((e: PaddleEvent) => void) | null): void {
  listener = fn;
}

function theme(): 'light' | 'dark' {
  try {
    const set = document.documentElement.dataset.theme;
    if (set === 'dark' || set === 'light') return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Put the card form INSIDE the page, the way Stripe and Linear checkouts do,
 * instead of in a pop-up over it. `frameClass` is the class of an empty
 * element on the page; Paddle fills it with its secure frame (the card details
 * still never touch AIBOS). In this mode Paddle shows only the form: the page
 * must show the item, subtotal, tax and total itself, which Paddle sends in
 * its checkout events (see checkoutTotals).
 *
 * `alive` is asked after Paddle.js has loaded: a page that moved on in the
 * meantime (another period chosen, back to mobile money) opens nothing.
 */
export async function mountInlineCheckout(opts: {
  transactionId: string;
  token: string;
  environment: string | null | undefined;
  frameClass: string;
  onEvent: (e: PaddleEvent) => void;
  alive: () => boolean;
}): Promise<void> {
  const paddle = await ensurePaddle(opts.token, opts.environment);
  if (!opts.alive()) return;
  onPaddleEvent(opts.onEvent);
  paddle.Checkout.open({
    transactionId: opts.transactionId,
    settings: {
      displayMode: 'inline',
      variant: 'one-page',
      frameTarget: opts.frameClass,
      frameInitialHeight: '450',
      // Paddle needs at least 286px of width to lay the form out.
      frameStyle: 'width: 100%; min-width: 286px; background-color: transparent; border: none;',
      theme: theme(),
      locale: 'en',
      allowLogout: false,
      // A promo code field. It is also how a plan is bought at zero cost with
      // a 100% discount, which is how Paddle asks sellers to test a live
      // checkout without money changing hands or a refund to undo.
      showAddDiscounts: true,
    },
  });
}

export function closeCardCheckout(): void {
  try { window.Paddle?.Checkout.close(); } catch { /* already closed */ }
}

/** What Paddle says the card checkout costs, once it knows the country. */
export interface CheckoutTotals {
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  /** What each renewal costs, tax included. */
  recurring: number | null;
  transactionId: string | null;
}

/** Totals from a Paddle checkout event (numbers in whole units: 39 = $39). */
export function checkoutTotals(e: PaddleEvent): CheckoutTotals | null {
  const d = e.data as {
    totals?: Record<string, unknown>;
    recurring_totals?: Record<string, unknown> | null;
    currency_code?: string;
    transaction_id?: string;
  } | undefined;
  const t = d?.totals;
  if (!t) return null;
  const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const subtotal = num(t.subtotal);
  const total = num(t.total);
  if (subtotal == null || total == null) return null;
  return {
    subtotal,
    tax: num(t.tax) ?? 0,
    total,
    currency: (d?.currency_code || 'USD').toUpperCase(),
    recurring: num(d?.recurring_totals?.total),
    transactionId: d?.transaction_id ?? null,
  };
}

/**
 * Money as the checkout shows it: $25, $29.50, K500. `cents` always shows two
 * decimals ($39.00), for a receipt-style list of amounts that line up.
 */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined, opts?: { cents?: boolean }): string {
  if (amount == null || Number.isNaN(amount)) return '';
  const whole = !opts?.cents && Math.abs(amount - Math.round(amount)) < 0.005;
  const figure = amount.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  const cur = (currency || 'ZMW').toUpperCase();
  if (cur === 'ZMW') return `K${figure}`;
  if (cur === 'USD') return `$${figure}`;
  return `${figure} ${cur}`;
}
