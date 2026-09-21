/**
 * AIBOS: the card checkout, through Paddle.
 *
 * Paddle sells card plans as Merchant of Record, so the card form is theirs:
 * Paddle.js opens it as an overlay above our checkout and nothing about the
 * card ever touches AIBOS. What we decide, we decide on the server: the API
 * makes the Paddle transaction (price, and whose account it pays for) and
 * the browser only opens it by its id.
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

/** Open the card checkout for a transaction the API made. */
export async function openCardCheckout(opts: {
  transactionId: string;
  token: string;
  environment: string | null | undefined;
  onEvent: (e: PaddleEvent) => void;
}): Promise<void> {
  const paddle = await ensurePaddle(opts.token, opts.environment);
  onPaddleEvent(opts.onEvent);
  paddle.Checkout.open({
    transactionId: opts.transactionId,
    settings: {
      displayMode: 'overlay',
      theme: theme(),
      locale: 'en',
      allowLogout: false,
      showAddDiscounts: false,
    },
  });
}

export function closeCardCheckout(): void {
  try { window.Paddle?.Checkout.close(); } catch { /* already closed */ }
}

/** Money as the checkout shows it: $25, $29.50, K500. */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '';
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  const figure = amount.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  const cur = (currency || 'ZMW').toUpperCase();
  if (cur === 'ZMW') return `K${figure}`;
  if (cur === 'USD') return `$${figure}`;
  return `${figure} ${cur}`;
}
