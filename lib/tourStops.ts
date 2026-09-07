/**
 * What a plan actually gives you, in the words an owner would use.
 *
 * This is the script for the welcome that appears after an upgrade. It is
 * deliberately NOT the pricing page's inclusions list: that list exists to sell
 * a plan to someone who has not bought it, and this one exists to show someone
 * who already has where their new things live. Every item points at a real page
 * in the product, or says plainly that it lives somewhere other than a page.
 *
 * Grouped into chapters so a Growth customer gets five screens rather than
 * fifteen. A chapter with nothing unlocked in it is dropped whole, so the same
 * script works for every plan without a special case per tier.
 *
 * Nothing here may reference an UNBUILT flag: canAccess() denies those to every
 * tier, so they filter themselves out, and scripts/check_unbuilt_features.py
 * goes red if one is ever named in the interface.
 */

import { canAccess, type Feature, type Tier } from '@/lib/tiers';

export interface TourItem {
  feature: Feature;
  /** What it is, as a thing you can do. */
  title: string;
  /** Why it is worth opening. One sentence, no jargon. */
  body: string;
  /** Where it lives. Absent when it is not a page of its own. */
  href?: string;
  /** Shown instead of a link when there is no page to send them to. */
  where?: string;
}

export interface TourChapter {
  key: string;
  heading: string;
  lead: string;
  items: TourItem[];
}

const SCRIPT: TourChapter[] = [
  {
    key: 'money',
    heading: 'Your money, all of it',
    lead: 'The locks are off Engine 1. These read your own recorded figures, so they are right from the moment you open them.',
    items: [
      {
        feature: 'forecast',
        title: 'See what is coming',
        body: 'Cash and profit projected from what you have already recorded, so you know before the month tells you.',
        href: '/dashboard/forecast',
      },
      {
        feature: 'anomaly',
        title: 'Be told when something is off',
        body: 'A cost that jumps, a sale that disappears, a pattern that breaks. You hear about it instead of finding it later.',
        href: '/dashboard/anomaly',
      },
      {
        feature: 'variance',
        title: 'This month against last',
        body: 'What moved and by how much, with the entries behind each change.',
        href: '/dashboard/variance',
      },
      {
        feature: 'breakeven',
        title: 'The number you have to hit',
        body: 'What you must take in a month to cover everything going out.',
        href: '/dashboard/breakeven',
      },
      {
        feature: 'full_history',
        title: 'Every month, not the last thirty days',
        body: 'Your whole record is open now, so trends have something to stand on.',
        href: '/dashboard/timeline',
      },
    ],
  },
  {
    key: 'ask',
    heading: 'Ask instead of dig',
    lead: 'The part people use most. It reads your real records and shows the entries behind every figure it gives you.',
    items: [
      {
        feature: 'ai_chat',
        title: 'Ask your CFO anything, as often as you like',
        body: 'Type the question the way you would ask a person. No daily limit any more.',
        where: 'The chat button, bottom right of every screen.',
      },
      {
        feature: 'chat_actions',
        title: 'Record a sale or an expense by typing it',
        body: 'Tell the chat what happened and it writes it into your books for you to confirm.',
        where: 'The same chat button.',
      },
      {
        feature: 'morning_brief',
        title: 'Your day, ready before you ask for it',
        body: 'What matters this morning, put together overnight from your own numbers.',
        href: '/dashboard/brief',
      },
      {
        feature: 'scheduled_brief',
        title: 'The brief, sent to you',
        body: 'The same summary in your inbox, daily or weekly, without opening anything.',
        href: '/dashboard/profile',
      },
    ],
  },
  {
    key: 'beyond',
    heading: 'Past the books',
    lead: 'Money is one engine. These are the other two, and what happens when they talk to each other.',
    items: [
      {
        feature: 'engine2',
        title: 'Know your customers',
        body: 'Who is worth the most, who is drifting away, and what they buy together.',
        href: '/dashboard/customers',
      },
      {
        feature: 'engine3',
        title: 'Watch the operation',
        body: 'What sells, what sits, and how you compare with businesses like yours.',
        href: '/dashboard/pos',
      },
      {
        feature: 'cross_engine',
        title: 'One score across every engine',
        body: 'Money, customers and operations reduced to a single signal you can check in a second.',
        href: '/dashboard',
      },
    ],
  },
  {
    key: 'run',
    heading: 'Run the day',
    lead: 'The jobs that are not analysis: the ones that have to happen on a date, for a person, or in a room.',
    items: [
      {
        feature: 'schedule',
        title: 'Nothing slips',
        body: 'NAPSA, ZRA, rent and anything else that repeats, set once and remembered for you.',
        href: '/dashboard/schedule',
      },
      {
        feature: 'payroll',
        title: 'Pay your people right',
        body: 'PAYE, NAPSA and NHIMA worked out for you, with a payslip for each person.',
        href: '/dashboard/employees',
      },
      {
        feature: 'hospitality',
        title: 'Run your rooms',
        body: 'One calendar for every unit, and a confirmed booking goes straight into your books.',
        href: '/dashboard/hospitality',
      },
      {
        feature: 'multi_business',
        title: 'Every business, one login',
        body: 'Separate books for each, and one switch to move between them.',
        where: 'The business name at the top of the screen.',
      },
    ],
  },
];

/** The chapters this plan actually unlocks, in order, with empty ones dropped. */
export function tourFor(tier: Tier): TourChapter[] {
  return SCRIPT.map((chapter) => ({
    ...chapter,
    items: chapter.items.filter((item) => canAccess(tier, item.feature)),
  })).filter((chapter) => chapter.items.length > 0);
}
