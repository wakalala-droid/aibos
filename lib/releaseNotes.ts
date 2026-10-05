// What shipped, in the owner's words, for the "What's new" screen
// (components/pwa/WhatsNew.tsx). Newest first. The screen shows the newest
// entry once to anyone who used AIBOS before it shipped: after "Get it now"
// on the update bar, or on their next visit. Someone opening AIBOS for the
// first time is not shown it.
//
// To announce a release: add an entry at the top with a new id. Keep each
// line to one plain sentence about what the owner will notice.

export type ReleaseIcon =
  | 'bento' | 'ink' | 'breakeven' | 'words' | 'assistant' | 'menu' | 'line' | 'studio';

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
