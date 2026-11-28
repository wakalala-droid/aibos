// lib/guide/screen.ts
// What the live guide sees (27 Nov 2026): the screen as a short text, not a
// picture. Pictures would cost about ten times more and could not be pointed
// at; this gives the guide the page, its headings, the figures on show and
// every button, link, tab and field in view, each with an id (g1, g2 ...) it
// can point at. Ids are handed out afresh on each read; the element behind
// each is kept here so point_at can find it.
//
// Only what is on screen and only words: never the value typed in a field
// (a password, an amount being typed), and never the guide's own sphere.

const MAX_ITEMS = 70;
const MAX_CHARS = 3200;

let targets = new Map<string, WeakRef<Element>>();

const INTERACTIVE = [
  'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
  '[role=button]', '[role=tab]', '[role=link]', '[role=switch]', '[role=menuitem]', '[data-tour]', '[data-guide]',
].join(',');

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
  const s = window.getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
}

function words(s: string | null | undefined, cap = 80): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > cap ? `${t.slice(0, cap - 1)}…` : t;
}

/** The name a screen reader would say, near enough. */
function nameOf(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return words(aria);
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const t = by.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    if (t.trim()) return words(t);
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '';
    return words(label || el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('title') || '');
  }
  return words((el as HTMLElement).innerText || el.textContent || el.getAttribute('title') || '');
}

function kind(el: Element): string {
  const role = el.getAttribute('role');
  if (role) return role;
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'input') return `field (${(el as HTMLInputElement).type || 'text'})`;
  if (tag === 'select') return 'choice';
  if (tag === 'textarea') return 'text box';
  if (tag === 'summary') return 'fold';
  if (el.hasAttribute('data-tour') || el.hasAttribute('data-guide')) return 'area';
  return tag;
}

function inGuide(el: Element): boolean {
  return !!el.closest('[data-guide-ui]');
}

/** The screen now, as the guide reads it. */
export function readScreen(pageLabel?: string): string {
  targets = new Map();
  const lines: string[] = [];
  const title = pageLabel || document.title.replace(/\s*·\s*AI-BOS.*$/, '');
  lines.push(`Page: ${title} (${location.pathname})`);
  lines.push(`Screen: ${window.innerWidth} by ${window.innerHeight}${window.innerWidth < 768 ? ', a phone' : ''}; scrolled ${Math.round(window.scrollY)} px down of ${Math.round(document.documentElement.scrollHeight)}.`);
  const dialog = document.querySelector('[role=dialog][aria-modal=true], [role=alertdialog]');
  const root: ParentNode = dialog && !inGuide(dialog) ? dialog : document;
  if (dialog && !inGuide(dialog)) lines.push(`A window is open over the page: ${nameOf(dialog) || 'untitled'}.`);

  const heads = [...root.querySelectorAll('h1, h2, h3, .bento-title, .eyebrow')]
    .filter((h) => !inGuide(h) && visible(h)).map((h) => words(h.textContent, 60)).filter(Boolean);
  if (heads.length) lines.push(`Headings in view: ${[...new Set(heads)].slice(0, 14).join(' | ')}`);

  // Figures in view: short bits of text with a number in them, as they read.
  const figs = [...root.querySelectorAll('p, span, dd, td, strong, div')]
    .filter((el) => el.children.length === 0 && !inGuide(el) && /\d/.test(el.textContent || '') && visible(el))
    .map((el) => words(el.textContent, 50))
    .filter((t) => t.length >= 2 && t.length <= 50);
  if (figs.length) lines.push(`Figures in view: ${[...new Set(figs)].slice(0, 24).join(' | ')}`);

  const seen = new Set<Element>();
  const items: string[] = [];
  let n = 0;
  for (const el of root.querySelectorAll(INTERACTIVE)) {
    if (items.length >= MAX_ITEMS) break;
    if (seen.has(el) || inGuide(el) || !visible(el)) continue;
    // An area marked for the tour holds buttons of its own: list it once, by name.
    seen.add(el);
    const name = nameOf(el);
    if (!name && el.tagName !== 'INPUT') continue;
    n += 1;
    const id = `g${n}`;
    targets.set(id, new WeakRef(el));
    const extra = (el as HTMLButtonElement).disabled ? ', cannot be used now' : '';
    const pressed = el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true' ? ', on' : '';
    items.push(`${id}: ${kind(el)} "${name || 'unnamed'}"${pressed}${extra}`);
  }
  if (items.length) lines.push('On screen you can point at:', ...items);
  else lines.push('Nothing to point at is in view.');
  let text = lines.join('\n');
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS)}\n(more below; scroll to see it)`;
  return text;
}

/** The element behind an id from the latest read, if it is still there. */
export function target(id: string): Element | null {
  const el = targets.get(String(id).trim())?.deref() ?? null;
  return el && el.isConnected ? el : null;
}
