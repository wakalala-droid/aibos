// The kit's bento grid placement (components/ui/BentoCard.tsx, docs/AIBOS_UI_KIT.md).
// A plain module, not a client one, so server components can call it too.

/** Grid placement for n cards in a .bento-grid, so the grid never leaves a
 *  hole: one card spans the row, two split it, three use the reference's
 *  big card with two beside it, four pair up and five use the full reference
 *  layout (4+2 tall, then 2, then 3 and 3). Past five they pair up, and an odd
 *  last card spans the row. */
export function bentoSpans(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return ['span-6'];
  if (n === 2) return ['span-3', 'span-3'];
  if (n === 3) return ['span-4 rows-2', 'span-2', 'span-2'];
  if (n === 4) return ['span-3', 'span-3', 'span-3', 'span-3'];
  const out = ['span-4 rows-2', 'span-2', 'span-2', 'span-3', 'span-3'];
  const rest = n - 5;
  for (let i = 0; i < rest; i++) out.push(i === rest - 1 && rest % 2 === 1 ? 'span-6' : 'span-3');
  return out;
}
