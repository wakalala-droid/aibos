// lib/guide/act.ts
// The sphere's hands (owner, 28 Nov 2026: "touch and control things ... when I
// say open this up for me, it does that"). AI-BOS taps and types on the
// owner's screen when asked, the same way a finger would, so every page's own
// checks and confirm windows still apply.
//
// Two lines it never crosses on its own:
//  * A tap that pays, sends, deletes, buys, signs out or cancels is refused
//    until the owner has said yes to that tap (the model calls again with
//    confirmed). The chat's money rules are the same: nothing moves unasked.
//  * It never types into a password, card or hidden field, and never touches
//    the sphere itself.

import { target } from '@/lib/guide/screen';

// Words on a control that mean it does something that cannot simply be taken back.
const WEIGHTY = /\b(pay|paid|send|sent|submit|delete|remove|erase|discard|archive|void|refund|transfer|withdraw|buy|purchase|upgrade|subscribe|checkout|check out|cancel (my |the )?(plan|subscription|account)|sign out|log out|logout|reset|start fresh|wipe|approve|confirm payment|run payroll|post (it|entries)|publish|invite|share)\b/i;

function nameOf(el: Element): string {
  return ((el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.textContent || el.getAttribute('title') || '')
    .replace(/\s+/g, ' ').trim()).slice(0, 80);
}

/** Does tapping this do something weighty (money, a message, a deletion, signing out)? */
export function isWeighty(el: Element): boolean {
  const words = `${nameOf(el)} ${el.getAttribute('data-guide-weight') || ''}`;
  if (el.closest('form') && (el as HTMLButtonElement).type === 'submit' && /\b(pay|send|save payment)\b/i.test(words)) return true;
  return WEIGHTY.test(words) || el.hasAttribute('data-weighty');
}

function off(el: Element): string | null {
  if (el.closest('[data-guide-ui]')) return 'That is the sphere itself.';
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return `"${nameOf(el)}" cannot be used right now.`;
  return null;
}

/** Tap an element from the latest read. */
export function tap(id: string, confirmed: boolean): { ok: boolean; said: string } {
  const el = target(id);
  if (!el) return { ok: false, said: `There is no ${id} on screen now. Call read_screen again.` };
  const no = off(el);
  if (no) return { ok: false, said: no };
  const name = nameOf(el) || id;
  if (isWeighty(el) && !confirmed) {
    return { ok: false, said: `Not tapped yet: "${name}" pays, sends, deletes, buys or signs out. Read back what it will do, ask the user to say yes, and only then call click again with confirmed true.` };
  }
  (el as HTMLElement).scrollIntoView?.({ block: 'center' });
  (el as HTMLElement).focus?.({ preventScroll: true });
  (el as HTMLElement).click();
  return { ok: true, said: `Tapped "${name}".` };
}

const NO_TYPE = /password|card|cvv|cvc|iban|account.?number|pin\b|otp|one.?time/i;

/** Type into a field from the latest read, as if typed (React sees it). */
export function typeInto(id: string, text: string): { ok: boolean; said: string } {
  const el = target(id);
  if (!el) return { ok: false, said: `There is no ${id} on screen now. Call read_screen again.` };
  const no = off(el);
  if (no) return { ok: false, said: no };
  const value = String(text ?? '').slice(0, 2000);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const kind = el instanceof HTMLInputElement ? el.type : 'textarea';
    const what = `${kind} ${el.name} ${el.id} ${el.autocomplete} ${el.getAttribute('aria-label') || ''} ${el.placeholder || ''}`;
    if (['password', 'hidden', 'file'].includes(kind) || NO_TYPE.test(what) || /^cc-/.test(el.autocomplete || '')) {
      return { ok: false, said: 'That field is for the user alone (a password, card or code). Ask them to type it.' };
    }
    if (el.readOnly) return { ok: false, said: 'That field cannot be typed in.' };
    const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    el.focus({ preventScroll: false });
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, said: `Typed "${value.slice(0, 60)}" into "${nameOf(el) || el.placeholder || id}".` };
  }
  if ((el as HTMLElement).isContentEditable) {
    (el as HTMLElement).focus();
    (el as HTMLElement).textContent = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true, said: `Typed into "${nameOf(el) || id}".` };
  }
  if (el instanceof HTMLSelectElement) {
    const opt = [...el.options].find((o) => o.text.trim().toLowerCase() === value.trim().toLowerCase()
      || o.value.toLowerCase() === value.trim().toLowerCase());
    if (!opt) return { ok: false, said: `"${nameOf(el)}" has no choice "${value}". The choices are: ${[...el.options].map((o) => o.text.trim()).join(', ')}.` };
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(el, opt.value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, said: `Chose "${opt.text.trim()}".` };
  }
  return { ok: false, said: `"${nameOf(el) || id}" is not a field you can type in. Tap it instead.` };
}

/** Plain words for speaking: no markdown stars, links or headings. */
export function spoken(md: string): string {
  return md
    .replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 3000);
}
