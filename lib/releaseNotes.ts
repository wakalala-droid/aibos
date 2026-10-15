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
