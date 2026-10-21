'use client';

/**
 * The iPhone app sells nothing (owner, 21 Oct 2026).
 *
 * Apple lets a free companion app to a paid web service into the App Store only
 * if the app sells nothing and does not point people to buy outside it (App
 * Store Review Guideline 3.1.3(f)). So inside the iPhone app there is no button,
 * link or answer that sells a plan, shows a price or says "upgrade". Android and
 * the browser are untouched.
 *
 * ONE PLACE. Every screen that used to sell asks this file:
 *   useIosApp()       in a component: true inside the iPhone app.
 *   inIosApp()        in plain code (the assistant, a click handler).
 *   NOT_ON_PLAN       what a locked feature says instead of a price.
 *   withoutSales()    takes selling out of words the server or the AI wrote.
 * and globals.css hides any plan link left on a page (html[data-app="ios"]).
 * The app is known before the first paint (APP_BOOT_SCRIPT, lib/nativeApp.ts),
 * so the first render on the server is the browser's and the phone corrects it
 * at once.
 */

import { useSyncExternalStore } from 'react';
import { inApp } from '@/lib/nativeApp';

const noSubscription = () => () => { /* the app never changes while a window lives */ };

/** True inside the iPhone app, false on the server, in a browser and in the Android app. */
export function useIosApp(): boolean {
  return useSyncExternalStore(noSubscription, () => inApp() === 'ios', () => false);
}

/** The same, for code that is not a component. */
export function inIosApp(): boolean {
  return inApp() === 'ios';
}

/** What a locked feature says in the iPhone app: the plain fact, no price and no way to buy. */
export const NOT_ON_PLAN = 'This is not part of your plan.';
export const NOT_ON_PLAN_SHORT = 'Not on your plan';
/** What a question about prices or plans is answered with in the iPhone app. */
export const NOT_SOLD_HERE = 'Plans are not sold in the iPhone app. Your plan and everything in it work here, whichever device it was bought on.';

/** A question about buying AIBOS, its plans or their price (not "how much did I spend"). */
export const ASKS_TO_BUY = /\b(?:upgrad(?:e|es|ing)|pricing|subscri(?:be|ption)s?|(?:pro\+?|growth)\s+(?:plan|tier)|(?:which|what|compare|cheapest|best)\s+(?:aibos\s+)?(?:plans?|tiers?)\b|plans?\s+(?:cost|price|prices)|how much\s+(?:is|does|are|do|will)\s+(?:the\s+|your\s+|an?\s+)?(?:aibos|pro\+?|growth|plans?|subscription)|(?:buy|purchase|pay for)\s+(?:aibos|pro|growth)|checkout)/i;

/** Does this address lead to the plans, the prices or a checkout? */
export function isSalesHref(href: string): boolean {
  return /^(?:https?:\/\/[^/]+)?\/(?:pricing|checkout)(?=[/?#]|$)/i.test(href.trim());
}

/** A sentence is selling when it talks of upgrading, the pricing page or a checkout, links
 *  to either, or names a plan together with buying it or what it costs. A plan is named by
 *  its tag (Pro+, "the Pro plan", "on Growth") and never by a bare word: "Growth in costs"
 *  is the owner's business, not a plan. */
const PLAN_NAME = /\bPro\+|\b(?:Pro|Growth) (?:plan|tier)s?\b|\b(?:on|with|to|for|into|from) (?:Pro|Growth)\b/;
const PLAN_PHRASE = /\b(?:free|paid|AIBOS|AI-BOS) (?:plans?|tiers?)\b|\byour (?:AIBOS|current|paid|free) plan\b/i;
const BUYING = /\b(?:subscri(?:be|bes|bing|ption)|card payment|sign up|buy|purchase|unlock|prices?|costs?)\b/i;
const A_PRICE = /(?:\$|US\$|K|ZMW)\s?\d[\d,.]*\s*(?:\/|a |per )\s*(?:month|mo|year|yr)\b/i;
const A_PLAN_WORD = /\b(?:Pro\+?|Growth|plans?|subscription)\b/;
/** The markdown links that lead to buying, with their words. */
const SALES_LINK = /\[[^\]]*\]\(\s*(?:https?:\/\/[^/)\s]+)?\/(?:pricing|checkout)[^)]*\)/gi;

function sellsPlan(sentence: string): boolean {
  if (/\bupgrad(?:e|es|ed|ing)\b/i.test(sentence)) return true;
  if (/\bpricing page\b|\bcheckout\b/i.test(sentence)) return true;
  if (new RegExp(SALES_LINK.source, 'i').test(sentence)) return true;
  // A rent of K450 a month is the owner's own figure: a price counts only beside a plan.
  if (A_PRICE.test(sentence) && A_PLAN_WORD.test(sentence)) return true;
  return (PLAN_NAME.test(sentence) || PLAN_PHRASE.test(sentence)) && BUYING.test(sentence);
}

/** Selling taken out of words the server or the AI wrote: the sales links and the
 *  sentences about upgrading or what a plan costs. What is left reads as before. */
export function withoutSales(text: string): string {
  // "Payroll is a Pro feature" becomes the plain fact.
  const clean = text.replace(/\bis an? (?:\*\*)?(?:Pro\+?|Growth)(?:\*\*)? feature\b/g, 'is not part of your plan');
  const kept = clean.split('\n').map((line) => {
    if (!line.trim()) return line;
    const lead = line.match(/^(\s*(?:[*\-•]|\d+[.)])?\s*)/)?.[0] ?? '';
    const body = line.slice(lead.length);
    const sentences = body.split(/(?<=[.!?])\s+/);
    const left = sentences.filter((s) => !sellsPlan(s));
    if (left.length === sentences.length) return line;
    return left.length ? lead + left.join(' ') : '';
  });
  // A sentence with a sales link goes whole, so no fragment of it is left; the
  // replace is for a link that somehow survived. Lines removed whole leave their
  // blank neighbours behind.
  return kept.join('\n').replace(SALES_LINK, '').replace(/\n{3,}/g, '\n\n').trim();
}
