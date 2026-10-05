// Owner words for the till reports (second bento pass, 5 Oct 2026).
//
// The till engine (aibos-api engine3.py) names its measures the way an
// analyst would ("Drink Attach Rate", "Top 3 SKU Concentration") and writes
// menu advice with "velocity" and "units/day". Results already saved on a
// device keep those strings, so they are put into plain words here, where
// they are shown, rather than only at the source.

export interface BenchWords {
  /** What the measure is, in plain words. */
  name: string;
  /** One line on why it matters. */
  why: string;
  /** Higher is better (drinks with a meal) or lower is better (discounts). */
  higherBetter: boolean;
}

export const BENCH_WORDS: Record<string, BenchWords> = {
  drink_attach_pct:       { name: 'Meals sold with a drink', why: 'A drink with every meal is the easiest sale you can add.', higherBetter: true },
  side_attach_pct:        { name: 'Meals sold with a side', why: 'A side with a meal lifts every order a little.', higherBetter: true },
  top3_sku_concentration: { name: 'Sales from your top 3 items', why: 'Too much from three items leaves you exposed if one runs out.', higherBetter: false },
  discount_rate_pct:      { name: 'Given away in discounts', why: 'Every discount comes straight off your profit.', higherBetter: false },
  category_mix_primary:   { name: 'Sales from your biggest category', why: 'A spread across categories steadies your takings.', higherBetter: false },
  avg_order_value:        { name: 'Average order', why: 'A bigger order means more from each customer who walks in.', higherBetter: true },
  food_cost_pct:          { name: 'Food cost', why: 'What the ingredients cost, out of every sale.', higherBetter: false },
  net_margin_pct:         { name: 'Kept as profit', why: 'What is left from each sale once everything is paid.', higherBetter: true },
  waste_pct:              { name: 'Thrown away', why: 'Stock you paid for and never sold.', higherBetter: false },
};

export function benchWords(metric: string, fallbackLabel: string): BenchWords {
  return BENCH_WORDS[metric] ?? { name: fallbackLabel, why: '', higherBetter: true };
}

/** "On target" / "Off target" / "Far off", and whether it is the red kind. */
export function benchStatus(status: string): { word: string; bad: boolean } {
  if (status === 'alert') return { word: 'Far off', bad: true };
  if (status === 'warn') return { word: 'Off target', bad: true };
  return { word: 'On target', bad: false };
}

/** How the figure sits against its mark, in a sentence. */
export function benchLine(actual: number, mark: number, unit: string, higherBetter: boolean): string {
  const u = unit === 'K' ? '' : unit;
  const diff = Math.abs(actual - mark);
  const pts = u === '%' ? ` point${diff.toFixed(1) === '1.0' ? '' : 's'}` : u;
  if (higherBetter) {
    return actual >= mark
      ? `${diff.toFixed(1)}${pts} above the ${mark}${u} that similar businesses reach.`
      : `${diff.toFixed(1)}${pts} short of the ${mark}${u} that similar businesses reach.`;
  }
  return actual <= mark
    ? `Inside the ${mark}${u} limit, with ${diff.toFixed(1)}${pts} to spare.`
    : `${diff.toFixed(1)}${pts} over the ${mark}${u} limit.`;
}

/** How fast something sells, from units a day. */
export function paceWords(perDay: number): string {
  if (!(perDay > 0)) return 'no sales at all';
  if (perDay < 1) {
    const every = Math.max(2, Math.round(1 / perDay));
    return `about one every ${every} days`;
  }
  return `about ${Math.round(perDay)} a day`;
}

export type GapKind = 'remove' | 'promote' | 'price' | 'other';

/** A menu gap from the till engine, in plain words. */
export function menuGapWords(issue: string, opportunity: string): { kind: GapKind; issue: string; action: string } {
  const num = Number((issue.match(/\(([\d.]+)\s*units\/day\)/) ?? [])[1]);
  if (/zero sales/i.test(issue)) {
    return { kind: 'remove', issue: 'Nothing sold in this period.', action: 'Take it off the menu, or try one promotion first.' };
  }
  if (/low velocity/i.test(issue)) {
    return { kind: 'promote', issue: `Sells slowly (${paceWords(num)}) but costs more than most items.`, action: 'Put it in front of customers. It earns well on each sale, but few know it is there.' };
  }
  if (/high velocity/i.test(issue)) {
    return { kind: 'price', issue: `Sells fast (${paceWords(num)}) but is cheaper than most items.`, action: 'Try raising the price by 10 to 15%. People clearly want it.' };
  }
  // Anything new from the engine: strip the arrow and dashes it writes with.
  const clean = (t: string) => t.replace(/\s*[\u2014\u2013]\s*/g, '. ').replace(/^\u2192\s*/, '').trim();
  return { kind: 'other', issue: clean(issue), action: clean(opportunity) };
}
