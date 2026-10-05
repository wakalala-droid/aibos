'use client';

// Stat: one figure in a panel, built exactly like Home's "Sales today" card
// (redesign 2026-10): a quiet title with one round action on the right, the
// figure in the money voice (raised cents, and a roll when it changes) and
// one plain line under it. Every page's headline numbers use this, so Get
// paid, Stock, Staff and Rooms read like Home.

import Panel from '@/components/home/Panel';
import BigMoney from '@/components/home/BigMoney';

export default function Stat({ label, money, count, text, sym = 'K', sub, tone, valueTone, action, explainId, loading }: {
  label: string;
  /** A money figure: shown with raised cents and rolled when it changes. */
  money?: number;
  /** A plain count ("3"). */
  count?: number;
  /** Anything else, already worded ("Not shrinking"). */
  text?: React.ReactNode;
  sym?: string;
  sub?: React.ReactNode;
  /** Colour the line under the figure: 'bad' red, 'good' green, 'warn' amber. */
  tone?: 'good' | 'bad' | 'warn';
  /** Accepted from older callers; every figure is ink since 5 Oct 2026. */
  valueTone?: 'good' | 'bad' | 'warn';
  /** One round icon link or button for the title row (className="icon-pill"). */
  action?: React.ReactNode;
  explainId?: string;
  loading?: boolean;
}) {
  const colour = (t?: 'good' | 'bad' | 'warn') =>
    t === 'bad' ? 'var(--red)' : t === 'good' ? 'var(--green)' : t === 'warn' ? 'var(--amber)' : undefined;
  return (
    <Panel title={label} action={action} explainId={explainId}>
      {loading ? <div className="skeleton" style={{ height: 64 }} /> : (
        <>
          {money !== undefined ? <BigMoney value={money} sym={sym} size="lg" roll />
            : (
              <span className="money money-lg">
                {count !== undefined ? count.toLocaleString('en-ZM') : text}
              </span>
            )}
          {sub && (
            <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-label)', color: colour(tone) ?? 'var(--text-3)', fontWeight: tone ? 600 : 400 }}>
              {sub}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
