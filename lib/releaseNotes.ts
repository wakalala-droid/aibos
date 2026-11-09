// What shipped, in the owner's words, for the "What's new" screen
// (components/pwa/WhatsNew.tsx). Newest first. The screen shows the newest
// entry once to anyone who used AIBOS before it shipped: after "Get it now"
// on the update bar, or on their next visit. Someone opening AIBOS for the
// first time is not shown it.
//
// To announce a release: add an entry at the top with a new id. Keep each
// line to one plain sentence about what the owner will notice.

export type ReleaseIcon =
  | 'bento' | 'ink' | 'breakeven' | 'words' | 'assistant' | 'menu' | 'line' | 'studio'
  | 'plan' | 'warn' | 'decide' | 'group' | 'accuracy';

export interface Release {
  /** Unique; seen once per device. */
  id: string;
  /** ISO date it shipped. */
  date: string;
  title: string;
  intro: string;
  items: { icon: ReleaseIcon; title: string; text: string }[];
}

export const RELEASES: Release[] = [
  {
    id: '2026-11-09-find-clients-credits',
    date: '2026-11-09',
    title: 'Find clients answers in seconds',
    intro: "Searches now read AIBOS's own list of places, and Find clients is priced the simple way: try it free, then top up.",
    items: [
      { icon: 'accuracy', title: 'No more timeouts', text: 'AIBOS keeps its own list of places around every town, so a search answers in seconds. If a place is new, AIBOS keeps asking the map for you.' },
      { icon: 'assistant', title: 'New businesses every time', text: 'Each search adds the nearest businesses you do not have yet, so pressing it again brings the next ones.' },
      { icon: 'plan', title: 'Free for a day', text: 'On Free, AIBOS researches and writes to 10 businesses in the 24 hours after your first search. Pro researches 50 a month, Pro+ 100 and Growth 300.' },
      { icon: 'words', title: 'Top up any time', text: 'Buy 100 businesses for $5, 300 for $12 or 1,000 for $35 by card, on any plan. They never run out. Finding businesses costs nothing.' },
    ],
  },
  {
    id: '2026-11-07-find-clients-every-plan',
    date: '2026-11-07',
    title: 'Find clients is on your plan',
    intro: 'Every plan now finds businesses that could buy from you, Free included. The plans differ in how many a month.',
    items: [
      { icon: 'assistant', title: 'Show me who could buy from me', text: 'Say in a line what you sell and who to, press once, and AIBOS finds businesses near you, reads the first few and writes to the ones that fit.' },
      { icon: 'plan', title: 'How many a month', text: 'Free researches 20 businesses a month, Pro 50, Pro+ 100 and Growth 300. Finding them on the map does not count.' },
      { icon: 'accuracy', title: 'A faster, steadier map search', text: 'The search now asks several map servers at once and carries on while you wait, so it no longer stops with an error.' },
      { icon: 'words', title: 'Still sent by you', text: 'Nothing goes out until you press send in your own email or WhatsApp.' },
    ],
  },
  {
    id: '2026-11-05-find-clients',
    date: '2026-11-05',
    title: 'Find your next customers',
    intro: 'On Growth, AIBOS now looks for businesses that could buy from you and writes to them for you to send.',
    items: [
      { icon: 'assistant', title: 'Businesses found for you (Growth)', text: 'Pick a kind of business and a town, or paste your own list, and AIBOS adds them without finding anyone twice.' },
      { icon: 'decide', title: 'Which ones fit, and why', text: 'AIBOS reads each website, scores the fit and writes the first message to the ones worth writing to: 300 a month.' },
      { icon: 'words', title: 'Sent from your own email or WhatsApp', text: 'Nothing goes out until you press send there, and anyone who asks you to stop is never written to again.' },
      { icon: 'line', title: 'Replies and follow-ups', text: 'Paste what they wrote back and AIBOS says what it means, drafts your answer and tells you when a follow-up is due.' },
    ],
  },
  {
    id: '2026-10-16-chase-and-pace',
    date: '2026-10-16',
    title: 'Who to ask for money first',
    intro: 'Your plan now acts: on Home, in your pocket every Monday, and on your monthly targets.',
    items: [
      { icon: 'plan', title: 'The next 13 weeks on Home (Growth)', text: 'What is safe to spend today, the chance of running short and what is due out in the next two weeks, the moment you open AIBOS.' },
      { icon: 'assistant', title: 'Ask for money first (Growth)', text: 'Debts in the order that helps your money most, each with the reminder and your payment link ready to send on WhatsApp.' },
      { icon: 'warn', title: 'Your week ahead (Growth)', text: 'Every Monday morning on your phone: what goes out and when, what is likely to come in, and who to ask first.' },
      { icon: 'line', title: 'Targets judged on pace', text: 'Halfway through the month your plan no longer reads red for half a month of sales: it says what the month is on pace for and the chance you hit it.' },
    ],
  },
  {
    id: '2026-10-16-cash-plan',
    date: '2026-10-16',
    title: 'See your money 13 weeks ahead',
    intro: 'A smarter forecast on every paid plan, and a cash plan on Growth that warns you before money runs short.',
    items: [
      { icon: 'line', title: 'A smarter forecast', text: 'Several methods are tested on your own months and the best are blended, with the range your sales should land in.' },
      { icon: 'accuracy', title: 'It says how accurate it is', text: 'The Forecast page shows how far off it has been on your past months, beside simply repeating last month.' },
      { icon: 'plan', title: 'The 13-week cash plan (Growth)', text: 'Wages, ZRA, rent and what customers owe, day by day, with the chance you run short and what is safe to spend today.' },
      { icon: 'warn', title: 'A warning before money runs short', text: 'Growth owners get a notification on their phone weeks ahead, with the move that fixes it.' },
      { icon: 'decide', title: 'Try a decision first', text: 'See what a purchase, a hire or a price change does to the next 13 weeks before you make it.' },
      { icon: 'group', title: 'All your businesses together', text: 'One cash plan across every business you run, and when one can cover another.' },
    ],
  },
  {
    id: '2026-10-05-bento',
    date: '2026-10-05',
    title: 'AIBOS has a new look',
    intro: 'Cleaner cards, one colour for numbers and reports that speak plainly. Here is what changed.',
    items: [
      { icon: 'bento', title: 'New cards everywhere', text: 'Home, the briefs, the reports and the small cards now share one calm card style, and dark mode is a true black.' },
      { icon: 'ink', title: 'One colour for numbers', text: 'Every figure is in the same ink. Red now means one thing only: something went the wrong way.' },
      { icon: 'breakeven', title: 'A clearer breakeven', text: 'See where your sales cross your costs, how much room you have and each month against the line.' },
      { icon: 'words', title: 'Reports in plain words', text: 'How you compare, Till sales and Month by month say what they mean, with no jargon.' },
      { icon: 'assistant', title: 'Ask AIBOS, restyled', text: 'Both assistant panels match the new cards, with bigger buttons that are easy to tap.' },
      { icon: 'menu', title: 'A tidier side menu', text: 'New icons in one style, and the light and dark switch no longer gets cut off.' },
      { icon: 'line', title: 'Money line fixed', text: 'The shading on the Home money line now always sits under the line, even when the balance dips below zero.' },
      { icon: 'studio', title: 'Data Studio retired', text: 'What it did now lives on Home and in the reports. Old links open Home.' },
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0];
