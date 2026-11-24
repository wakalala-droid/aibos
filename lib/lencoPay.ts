/**
 * Lenco's own secure card window (Lenco Pay inline, migration 0049).
 *
 * The guest types their card into Lenco's frame, never into AIBOS, so no card
 * number ever reaches this app or its server. Any bank's Visa or Mastercard
 * works. The server hands over the reference, the amount and the business's
 * PUBLIC key (POST /pay/stay/{token}/card); when the window says it is done,
 * the page asks the server, and the server asks Lenco what really arrived.
 *
 * The script comes from Lenco only (pay.lenco.co, or pay.sandbox.lenco.co
 * with a test key). next.config.js lets those two hosts load and frame.
 */

export interface LencoPayOptions {
  key: string;
  reference: string;
  email: string;
  amount: number;
  currency: string;
  label?: string;
  bearer?: 'merchant' | 'customer';
  channels?: ('card' | 'mobile-money')[];
  customer?: { firstName?: string; lastName?: string; phone?: string };
  onSuccess: (response: { reference?: string }) => void;
  onClose: () => void;
  onConfirmationPending: () => void;
}

declare global {
  interface Window {
    LencoPay?: { getPaid: (options: LencoPayOptions) => void };
  }
}

const LENCO_SCRIPT = /^https:\/\/pay(\.sandbox)?\.lenco\.co\/js\/v1\/inline\.js$/;
const loading: Record<string, Promise<void>> = {};

/** Load Lenco's script once. Refuses any address that is not Lenco's. */
export function loadLencoPay(src: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('The card window needs a browser.'));
  if (!LENCO_SCRIPT.test(src)) return Promise.reject(new Error('The card window could not be opened.'));
  if (window.LencoPay) return Promise.resolve();
  if (!loading[src]) {
    loading[src] = new Promise<void>((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = src;
      tag.async = true;
      tag.onload = () => (window.LencoPay
        ? resolve()
        : reject(new Error('The card window did not open. Please try again.')));
      tag.onerror = () => {
        delete loading[src];
        tag.remove();
        reject(new Error('The card window could not load. Check your connection and try again.'));
      };
      document.head.appendChild(tag);
    });
  }
  return loading[src];
}

/** How the window ended: paid (Lenco is now checking it), closed, or
 *  waiting on the bank (3-D Secure, or a payment Lenco is still confirming). */
export type LencoOutcome = 'success' | 'closed' | 'pending';

/** Open the card window and settle on how it ended. */
export async function openLencoCardWindow(
  src: string,
  options: Omit<LencoPayOptions, 'onSuccess' | 'onClose' | 'onConfirmationPending'>,
): Promise<LencoOutcome> {
  await loadLencoPay(src);
  return new Promise<LencoOutcome>((resolve) => {
    let done = false;
    const end = (outcome: LencoOutcome) => { if (!done) { done = true; resolve(outcome); } };
    window.LencoPay!.getPaid({
      bearer: 'merchant',
      channels: ['card'],
      ...options,
      onSuccess: () => end('success'),
      onClose: () => end('closed'),
      onConfirmationPending: () => end('pending'),
    });
  });
}

export const looksLikeEmail = (value: string) => /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[a-z]{2,}$/i.test(value.trim());
