// lib/scenario.ts — deterministic "what if" modeling on the owner's REAL P&L.
//
// "What if fuel goes up 20%?" deserves arithmetic, not vibes. This module
// parses the question, averages the owner's recent recorded months, and shows
// the effect — with assumptions stated out loud and RANGED where the truth
// depends on cost behaviour (conversion_psychology.md: honest, ranged outputs;
// SAFEGUARD §0.1: no fabricated precision). A simple model, clearly labelled —
// never called a forecast.

import type { MonthlyRow } from './store';
import { fmt } from './utils';

export interface Scenario {
  target: 'costs' | 'sales' | 'price';
  direction: 1 | -1;
  /** Percentage as a fraction, e.g. 0.2 for 20%. */
  pct: number;
}

const WHAT_IF = /\bwhat\s+(?:if|happens\s+if|would\s+happen\s+if)\b/;
const UP = /\b(up|rise|rises|rose|increase|increases|increased|higher|more|double)\b/;
const DOWN = /\b(down|drop|drops|dropped|fall|falls|fell|decrease|decreases|decreased|lower|less|cut|halve)\b/;
const COSTS = /\b(cost|costs|expense|expenses|fuel|diesel|petrol|rent|wages?|salar\w*|electricity|power|inputs?|supplies|transport)\b/;
const SALES = /\b(sales?|revenue|customers?|demand|volume|orders?|takings)\b/;
const PRICE = /\b(price|prices|charge|charges|rate|rates)\b/;

export function parseScenario(raw: string): Scenario | null {
  const q = raw.toLowerCase();
  if (!WHAT_IF.test(q)) return null;

  let pct: number | null = null;
  const m = q.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);
  if (m) pct = parseFloat(m[1]) / 100;
  else if (/\bdouble\b/.test(q)) pct = 1;
  else if (/\bhalve\b|\bhalf\b/.test(q)) pct = 0.5;
  if (pct === null || !isFinite(pct) || pct <= 0 || pct > 5) return null;

  const direction: 1 | -1 = DOWN.test(q) && !UP.test(q) ? -1 : 1;

  // Price beats sales beats costs when several words appear — "raise my
  // prices" mentioning "sales" later should still model a price change.
  const target = PRICE.test(q) ? 'price' : SALES.test(q) ? 'sales' : COSTS.test(q) ? 'costs' : null;
  if (!target) return null;

  return { target, direction, pct };
}

/** Average the last up-to-6 recorded months. Null when there's nothing real. */
function baseline(monthly: MonthlyRow[]): { rev: number; cost: number; months: number } | null {
  const rows = monthly.slice(-6).filter((r) => Number(r.Revenue) > 0 || Number(r.Costs) > 0);
  if (rows.length === 0) return null;
  const rev = rows.reduce((t, r) => t + (Number(r.Revenue) || 0), 0) / rows.length;
  const cost = rows.reduce((t, r) => t + (Number(r.Costs) || 0), 0) / rows.length;
  return { rev, cost, months: rows.length };
}

export function runScenario(sc: Scenario, monthly: MonthlyRow[], sym: string): string {
  const base = baseline(monthly);
  if (!base) {
    return "I can model that as soon as I have your financials — upload a P&L on the **Overview** page, or keep recording; after a month of activity I'll have real numbers to work with. I won't model a scenario on made-up figures.";
  }
  const money = (n: number) => fmt(n, true, sym);
  const { rev, cost, months } = base;
  const profitNow = rev - cost;
  const delta = sc.direction * sc.pct;
  const pctLabel = `${Math.round(sc.pct * 100)}%`;
  const dirWord = sc.direction === 1 ? 'up' : 'down';
  const basis = `Based on your last ${months} recorded month${months === 1 ? '' : 's'} (avg revenue ${money(rev)}, avg costs ${money(cost)}, profit ${money(profitNow)}/month):`;
  const coda = '\n\n_A simple model on your real averages — not a forecast. Useful for direction, not for decimals._';

  if (sc.target === 'costs') {
    const after = rev - cost * (1 + delta);
    return [
      basis,
      `If costs go ${dirWord} ${pctLabel} and sales stay the same, profit goes from **${money(profitNow)}** to **${money(after)}** per month (${money(after - profitNow)}).`,
      after < 0 ? '⚠️ That would put you below breakeven — worth stress-testing your biggest cost lines now.' : null,
    ].filter(Boolean).join('\n\n') + coda;
  }

  if (sc.target === 'price') {
    const after = rev * (1 + delta) - cost;
    return [
      basis,
      `If you change prices ${dirWord} ${pctLabel} and volume holds, profit goes from **${money(profitNow)}** to **${money(after)}** per month (${money(after - profitNow)}).`,
      sc.direction === 1
        ? 'In practice some customers buy less after a price rise — treat this as the upper end, and watch volume for two weeks after changing.'
        : 'A price cut needs enough extra volume to pay for itself — this shows the cost of the cut before any new customers arrive.',
    ].join('\n\n') + coda;
  }

  // sales volume: the honest answer is a RANGE — it depends how much of your
  // cost base moves with sales, and we don't pretend to know the split.
  const revAfter = rev * (1 + delta);
  const profitFixed = revAfter - cost;                 // no cost moves
  const profitVariable = revAfter - cost * (1 + delta); // every cost moves
  const lo = Math.min(profitFixed, profitVariable);
  const hi = Math.max(profitFixed, profitVariable);
  return [
    basis,
    `If sales go ${dirWord} ${pctLabel}, monthly profit lands between **${money(lo)}** and **${money(hi)}** — the exact spot depends on how much of your costs move with sales (stock does, rent doesn't).`,
  ].join('\n\n') + coda;
}
