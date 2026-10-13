/**
 * Money to the ngwee, the way the server keeps it (aibos-api/money.py).
 *
 * A browser multiplies in binary floats: 3 × 33.335 is 100.00499999999999, and
 * rounding that gives K100.00 where the amount is K100.005, which is K100.01.
 * The server works the same sum in exact decimals and saves K100.01, so the
 * invoice form showed one total and the invoice kept another. Here each figure
 * is read as the decimal it was typed as, multiplied as whole numbers, and
 * rounded half up to the ngwee once, at the end: the server's own rule.
 */

/** A number as an exact whole number and its decimal places: 33.335 → [33335, 3]. */
function scaled(n: number): [number, number] {
  if (!Number.isFinite(n) || n === 0) return [0, 0];
  let text = String(Math.abs(n));
  if (/e/i.test(text)) text = Math.abs(n).toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  const [whole, frac = ''] = text.split('.');
  return [Number(whole + frac) * Math.sign(n), frac.length];
}

/** The total of quantity × price lines, exact and rounded half up to the ngwee. */
export function linesTotal(lines: Array<{ qty: unknown; unit_price: unknown }>): number {
  const parts = lines.map((l) => {
    const [q, qs] = scaled(Number(l.qty) || 0);
    const [p, ps] = scaled(Number(l.unit_price) || 0);
    return { value: q * p, places: qs + ps };
  });
  const places = Math.max(2, ...parts.map((p) => p.places));
  let sum = 0;
  for (const p of parts) sum += p.value * 10 ** (places - p.places);
  if (!Number.isSafeInteger(sum)) {
    // Beyond what whole numbers hold exactly (billions with many decimals):
    // the float sum, which at that size is right to the ngwee anyway.
    const raw = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
    return Math.round(raw * 100) / 100;
  }
  const per = 10 ** (places - 2);
  const whole = Math.floor(sum / per);
  const rest = sum - whole * per;
  return (rest * 2 >= per ? whole + 1 : whole) / 100;
}

/** One figure in whole ngwee, half up (what the server keeps it as). */
export function toNgwee(value: unknown): number {
  return Math.round(linesTotal([{ qty: 1, unit_price: Number(value) || 0 }]) * 100);
}

/** The exact sum of money figures, each first rounded to the ngwee, as the
 *  server adds them up (money.total): a float sum of many entries drifts. */
export function sumMoney(values: Iterable<unknown>): number {
  let ngwee = 0;
  for (const v of values) ngwee += toNgwee(v);
  return ngwee / 100;
}
