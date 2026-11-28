// lib/guide/manual.ts
// What AI-BOS knows about itself (live guide, 27 Nov 2026). The live guide
// looks things up here (the aibos_manual tool) rather than guessing: AI-BOS
// works its own way and nobody knows it yet, so a made-up answer would teach
// the owner something wrong. Plain words, as the guide will say them.
//
// Keep it true: when a page, a setting or a plan changes, change its entry.
// The page list comes from lib/nav.ts (DOORS), so a new page is never missing.

import { ACCOUNT_DOORS, DOORS } from '@/lib/nav';
import { TIERS } from '@/lib/tiers';

export interface ManualEntry { id: string; title: string; words: string[]; text: string }

/** One line on what each page is for, by path. */
const PAGE_NOTES: Record<string, string> = {
  '/dashboard': 'Home: the greeting with Record and Talk, Needs you (the only to-do list), the AI-BOS team, the money right now and Today.',
  '/dashboard/record': 'Record: tell AI-BOS a sale or an expense in your own words, typed or said, or photograph a receipt. AI-BOS reads it and you confirm.',
  '/dashboard/cash': 'Money: the money right now and where it sits (cash, mobile money, bank), the line of the last days, money in and out each month, and how long it lasts.',
  '/dashboard/invoices': 'Get paid: invoices, who owes you and since when, and a mobile money payment link a customer can pay from.',
  '/dashboard/contacts': 'Customers: your customers and suppliers, what each has bought and owes.',
  '/dashboard/clients': 'Find clients: AI-BOS finds businesses that could buy from you, researches them and writes a first message. You send it yourself.',
  '/dashboard/hospitality': 'Rooms & Stays: rooms, bookings, deposits and guest payment links, on Growth.',
  '/dashboard/inventory': 'Stock: your products, what is left and what to reorder.',
  '/dashboard/employees': 'Staff: the staff register and payroll with PAYE, NAPSA and NHIMA worked out, and payslips.',
  '/dashboard/schedule': 'Schedule: reminders, meetings and deadlines such as ZRA and NAPSA, with reminders on your phone.',
  '/dashboard/timeline': 'Activity: every entry in your books, newest first. Fix or remove an entry here.',
  '/dashboard/numbers': 'Your numbers: the charts, scores and findings about the business.',
  '/dashboard/brief': 'Briefs: the morning brief and AI-BOS\'s advice.',
  '/dashboard/variance': 'Month by month: what changed from one month to the next, and why.',
  '/dashboard/cash-plan': 'Cash plan: the next 13 weeks of money from your own books, the chance you run short and what is safe to spend, on Growth.',
  '/dashboard/forecast': 'Forecast: where sales and costs are heading.',
  '/dashboard/anomaly': 'Unusual spending: spending that is out of the ordinary.',
  '/dashboard/breakeven': 'Breakeven: the sales that cover your costs.',
  '/dashboard/simulate': 'What if: try a price change, a hire or a purchase before you decide.',
  '/dashboard/customers': 'Best customers: who buys most and most often.',
  '/dashboard/churn': 'Quiet customers: regulars who have stopped coming.',
  '/dashboard/products': 'Product performance: best sellers and slow movers.',
  '/dashboard/market': 'Market: your customer groups.',
  '/dashboard/pos': 'Till sales: sales from a till system.',
  '/dashboard/benchmarks': 'How you compare: your figures beside businesses like yours.',
  '/dashboard/import': 'Upload a file: bring in a spreadsheet or the AI-BOS workbook.',
  '/dashboard/profile': 'Settings: business details, logo, your team, getting paid (mobile money), what AI-BOS has learned and exporting your books.',
  '/dashboard/teach': 'Teach AI-BOS your business: about five minutes of questions about your story, a normal month and your goals.',
  '/dashboard/billing': 'Plan and billing: your plan, receipts, upgrading and cancelling.',
  '/dashboard/reviews': 'Review AI-BOS: say what you think of AI-BOS.',
};

/** Every page the guide may open, with what it is. */
export const PAGES: { path: string; label: string; note: string }[] = [
  ...DOORS.map((d) => ({ path: d.href, label: d.label, note: PAGE_NOTES[d.href] ?? d.label })),
  ...ACCOUNT_DOORS.map((d) => ({ path: d.href, label: d.label, note: PAGE_NOTES[d.href] ?? d.label })),
];

const plans = (['free', 'pro', 'proplus', 'growth'] as const)
  .map((t) => `${TIERS[t].name} (${TIERS[t].priceMonthly ? `$${TIERS[t].priceMonthly} a month` : 'free'}): ${TIERS[t].inclusions.slice(0, 6).join('; ')}.`)
  .join('\n');

export const MANUAL: ManualEntry[] = [
  { id: 'what', title: 'What AI-BOS is', words: ['aibos', 'ai-bos', 'ai boss', 'name', 'what is', 'about', 'how does it work', 'start', 'new'],
    text: 'AI-BOS (written with a hyphen, said "AI boss") is a business operating system for small businesses. You tell it what happened (a sale, an expense) and it keeps your books, watches your money and tells you only what needs you. It has a team of AI workers that look through your books and ask before they act. Nothing is sent and no money moves until you say yes.' },
  { id: 'home', title: 'Home', words: ['home', 'dashboard', 'start page', 'greeting', 'one thing'],
    text: 'Home asks for one thing at a time. At the top, the greeting, with Record and Talk. Under it, Needs you: the only to-do list in AI-BOS, one line when nothing needs you. Then the AI-BOS team, the money right now and Today (sales today, what is owed, stock, what is coming up). At most one tip card shows at a time. On a phone the money comes before the team.' },
  { id: 'needs-you', title: 'Needs you', words: ['needs you', 'to do', 'tasks', 'waiting', 'yes', 'approve', 'jobs'],
    text: 'Needs you lists only what is waiting for you: entries to confirm, invoices that are late, a warning about cash, and jobs the AI-BOS team wants a yes for. Each has its own buttons: say yes, no, or open it. When nothing needs you it is one line.' },
  { id: 'team', title: 'The AI-BOS team', words: ['team', 'workers', 'bookkeeper', 'collector', 'tax clerk', 'payroll clerk', 'sales scout', 'guest desk', 'assistant', 'sphere', 'stage'],
    text: 'The AI-BOS team is the navy stage on Home: the AI-BOS mark in the middle and six workers round it. The Bookkeeper confirms entries, the Collector gets back money customers owe, the Tax clerk keeps PAYE, NAPSA, NHIMA and the levy on time, the Payroll clerk gets staff paid right, the Sales scout spots regular customers who have gone quiet, and the Guest desk looks after bookings. A cyan worker needs you, with a count; an outline one is watching. Tap a worker to see its jobs. They look through your books every few hours and ask before they act. The team comes with Pro+; the Guest desk with Growth.' },
  { id: 'auto', title: 'AI-BOS auto', words: ['auto', 'automatic', 'autopilot', 'switch', 'by itself', 'undo'],
    text: 'AI-BOS auto is the switch at the top right of every page. With it on, the team does the safe jobs by itself, like confirming entries up to K1,000 or up to the largest you have approved yourself, each with an Undo. Chasing money, tax payments and refunds always wait for you. After five yeses in a row on the same kind of entry, AI-BOS offers to record those by itself.' },
  { id: 'record', title: 'Recording', words: ['record', 'sale', 'expense', 'enter', 'add', 'receipt', 'photo', 'sold', 'spent'],
    text: 'To record, tap Record (on Home, in the menu, or the middle tab on a phone). Type or say it the way you would tell a friend, like "sold 3 bags of mealie meal for K450", or photograph a receipt. AI-BOS reads it, shows what it understood, and you confirm. Entries waiting for you are not counted in your money until confirmed. Recording is free on every plan.' },
  { id: 'talk', title: 'Talk and Ask AI-BOS', words: ['talk', 'voice', 'speak', 'ask', 'chat', 'question', 'assistant', 'microphone', 'type'],
    text: 'AI-BOS is one: the sphere at the bottom right, Talk on Home, the chat and the team are the same AI-BOS with the same memory of your books. Tap the sphere to talk out loud. To type instead, tap Chat in the sphere\'s bubble, or press Ctrl K. The chat answers from your own books; Free gets 3 questions a day and Pro and up have no limit. Anything it does to your books waits for your yes.' },
  { id: 'guide', title: 'The AI-BOS sphere', words: ['guide', 'live', 'sphere', 'help', 'point', 'show me', 'move the sphere', 'minutes', 'click', 'do it for me', 'control'],
    text: 'The sphere sits at the bottom right of every page. Tap it and talk. AI-BOS reads your screen, points at things and explains them, and when you ask it does things for you: opens pages, taps buttons, fills in fields, records a sale or an expense, makes an invoice or sends a reminder. Anything that pays, sends, deletes or changes your books is read back first and waits for your yes. Ask it anything about your figures or about how AI-BOS works, down to why it worked out a number the way it did. Drag the sphere anywhere; with it focused the arrow keys move it, and Alt G starts or ends a talk. Everything it says is written in the bubble beside it. Each plan has minutes a month of live talk: Free 5, Pro 15, Pro+ 30, Growth 60.' },
  { id: 'report', title: 'The spoken report', words: ['report', 'spoken report', 'how is my business', 'how am i doing', 'login', 'log in', 'morning', 'suggest'],
    text: 'The spoken report is AI-BOS telling you, out loud, how the business is doing: today and this month, what needs you, and three or four things it suggests you do next, then it helps you start on one. Turn it on in Settings, under The AI-BOS sphere, and AI-BOS offers it the first time you open the app each day: tap "Yes, tell me". You can also just ask the sphere "how is my business doing?" any time.' },
  { id: 'voice', title: 'Voice and sphere settings', words: ['voice', 'change voice', 'sound', 'accent', 'tips', 'hints', 'settings for the sphere', 'quiet'],
    text: 'In Settings, under The AI-BOS sphere, you choose the voice AI-BOS speaks in (eight voices, from firm and clear to deep and calm), turn the spoken report on or off, and turn tips on or off. With tips on, when you rest on a page you have not seen before, the sphere offers once to show you round it. Your choices follow you to every device.' },
  { id: 'money', title: 'Money and figures', words: ['money', 'cash', 'balance', 'profit', 'mobile money', 'bank', 'how long', 'runway', 'figure'],
    text: 'The money figure is what you have now, from your confirmed entries, split by where it sits: cash, mobile money and bank. The Money page shows the line of the last days, money in and out each month and how long the money lasts. Every money figure in AI-BOS comes from the same entries, so they agree.' },
  { id: 'brief', title: 'The morning brief', words: ['brief', 'morning', 'one thing today', '06:30', 'summary'],
    text: 'The morning brief is your cash, yesterday\'s sales, stock to reorder and the one thing to do today, at 06:30. Pro+ puts the one thing under your greeting on Home and sends the brief by email and to your phone. On every plan the one thing shows on Home free for 14 days once you have recorded on three different days.' },
  { id: 'menu', title: 'Finding your way', words: ['menu', 'navigate', 'find', 'where', 'search', 'pages', 'sidebar', 'tabs', 'reports'],
    text: 'On a computer the menu is on the left; the reports are folded under Reports. On a phone the tabs at the bottom are Home, Record, Money, Get paid and More, and the menu opens from the button at the top left. Ctrl K (or the search box) finds any page or answers a question. The business name at the top switches business, on Growth.' },
  { id: 'settings', title: 'Settings', words: ['settings', 'profile', 'logo', 'business details', 'invite', 'staff access', 'accountant', 'export', 'currency', 'mobile money number'],
    text: 'Settings (in the menu, or search "settings" with Ctrl K) holds your business details and logo, your team (invite staff and your accountant), getting paid (your mobile money details for payment links), what AI-BOS has learned about the business, and exporting your books. Plan and billing has its own page.' },
  { id: 'access', title: 'Accessibility and comfort', words: ['accessibility', 'dark mode', 'light mode', 'theme', 'text size', 'bigger', 'screen reader', 'keyboard', 'motion', 'captions', 'blind', 'deaf', 'contrast'],
    text: 'Light or dark: the sun or moon button (top right on a phone, at the foot of the menu on a computer). Text: AI-BOS uses 15 pixel body text with strong contrast; to make everything bigger, use your browser zoom (Ctrl and plus) or your phone\'s text size. Every button is at least 44 pixels to tap. Keyboard: Tab moves, Enter presses, Escape closes, Ctrl K searches, and a "Skip to main content" link comes first. Screen readers hear every button by name. If your device asks for less motion, AI-BOS keeps still. Talk and this guide write what they say on screen, and "Type instead" works everywhere you can talk.' },
  { id: 'language', title: 'Languages', words: ['language', 'nyanja', 'bemba', 'tonga', 'english', 'translate'],
    text: 'AI-BOS is written in English. You can tell it what happened in English, Nyanja, Bemba or Tonga, and set your preferred language in setup. This guide answers in the language you speak to it in.' },
  { id: 'plans', title: 'Plans', words: ['plan', 'price', 'pricing', 'free', 'pro', 'pro+', 'growth', 'upgrade', 'cost', 'billing', 'cancel'],
    text: `${plans}\nPlans are billed in US dollars by card and renew each month or year. Change or cancel on the Plan and billing page.` },
  { id: 'teach', title: 'Teach AI-BOS', words: ['teach', 'interview', 'goals', 'targets', 'story', 'workbook'],
    text: 'Teach AI-BOS your business is about five minutes of questions: how it started, what a normal month looks like and what you are aiming for. Your answers set your cash floor, your seasons and your targets. The AI-BOS workbook is a spreadsheet laid out the way AI-BOS reads, to fill in and upload.' },
  { id: 'safety', title: 'Safety and privacy', words: ['safe', 'privacy', 'data', 'send', 'pay', 'money moves', 'permission', 'secure'],
    text: 'AI-BOS never sends a message, moves money, deletes or buys anything unless you asked and then said yes when it read it back. Your books are yours: export them any time from Settings. The sphere hears you only while a talk is on (it glows), reads only the page in front of you and never a password or card number; AI-BOS keeps no recording.' },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();

/** The entries that answer a topic, best first, as text for the guide. */
export function lookUp(topic: string): string {
  const q = norm(topic);
  if (!q) return MANUAL[0].text;
  const words = q.split(' ').filter((w) => w.length > 2);
  const scored = MANUAL.map((e) => {
    let s = 0;
    for (const k of e.words) if (q.includes(k)) s += 3 + k.split(' ').length;
    for (const w of words) if (norm(e.title).includes(w) || e.words.some((k) => k.includes(w))) s += 1;
    return { e, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const pages = PAGES.filter((p) => words.some((w) => norm(p.label).includes(w) || p.path.includes(w)));
  const parts = scored.slice(0, 2).map((x) => `${x.e.title}: ${x.e.text}`);
  if (pages.length) parts.push(`Pages: ${pages.slice(0, 4).map((p) => `${p.label} (${p.path}): ${p.note}`).join(' ')}`);
  if (/\b(pages?|menu|where|all)\b/.test(q) && !pages.length) {
    parts.push(`Pages: ${PAGES.map((p) => `${p.label} (${p.path})`).join(', ')}.`);
  }
  return parts.length ? parts.join('\n\n') : 'The manual does not cover that. Say you are not sure, and suggest Ask AI-BOS.';
}
