'use client';

// The forecast's track record (16 October 2026): what AIBOS said before each
// month happened, kept once a month and never rewritten, held against the
// confirmed books once the month has closed (aibos-api track_record.py).
//
// "How accurate" beside it is a backtest, worked out today about months AIBOS
// already knew. This one is earned: the forecast was on record first. Status
// is told by the calendar's fill: navy came true, dashed is still to come, a
// plain outline missed.

import { CalendarCheck } from 'lucide-react';
import { BentoCard } from '@/components/kit';
import { Swatch, type Tone } from '@/components/hospitality/kit';
import { monthName } from '@/lib/change';
import { fmt } from '@/lib/utils';
import type { TrackRecord, TrackRow, TrackSummary } from '@/lib/api';

const SHOWN = 6;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "3 Dec", as the API words it (a browser may say "Sept"). */
function dayWords(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : `${d.getDate()} ${MON[d.getMonth()]}`;
}

function verdict(r: TrackRow): [Tone, string] {
  if (r.status === 'waiting') return ['wait', 'To come'];
  if (r.status === 'unrecorded') return ['off', 'Not recorded'];
  if (r.side === 'inside') return ['stay', 'Inside'];
  return ['off', r.side === 'above' ? 'Above' : 'Below'];
}

function Rows({ summary, sym, label }: { summary: TrackSummary; sym: string; label: (r: TrackRow) => string }) {
  // The months the sentence counts, newest first, under the next one to come.
  const done = summary.rows.filter((r) => r.status !== 'waiting').slice(-SHOWN).reverse();
  const rows = summary.next ? [summary.next, ...done] : done;
  return (
    <ul style={{ margin: '12px 0 0', padding: 0 }}>
      {rows.map((r) => {
        const [tone, word] = verdict(r);
        const said = `Said ${fmt(r.p10, true, sym)} to ${fmt(r.p90, true, sym)}`;
        const sub = r.status === 'waiting' && r.judged_from ? `${said}; checked from ${dayWords(r.judged_from)}`
          : r.status === 'unrecorded' ? `${said}; ${r.reason ?? 'nothing recorded yet'}` : said;
        return (
          <li key={r.target} className="row" style={{ listStyle: 'none', alignItems: 'flex-start' }}>
            <div className="row-main">
              <span className="row-title">{label(r)}</span>
              <span className="row-sub">{sub}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              {r.status === 'judged' && r.actual != null && <span className="row-amount">{fmt(r.actual, true, sym)}</span>}
              <span className="row-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Swatch tone={tone} />{word}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function ForecastTrackRecord({ record, sym, className }: {
  record: TrackRecord;
  sym: string;
  className?: string;
}) {
  const sales = record.sales;
  const cash = record.cash;
  const first = sales?.rows[0];
  const intro = !sales?.rows.length
    ? 'Each month AIBOS keeps its forecast for the month ahead before it happens, and checks it against your books once that month closes. The first is kept this month.'
    : `${sales.words}${sales.judged ? ` The range is built to hold ${Math.round(sales.expected_pct / 10)} times in 10.` : ''}`;
  return (
    <BentoCard className={className} icon={<CalendarCheck />} title="Track record" tag="Kept in advance"
      text={intro}
      foot={sales && sales.judged > 1 && first
        ? <span className="tnum" style={{ color: 'var(--text-3)' }}>Inside {sales.inside} of {sales.judged} since {monthName(first.target)}</span>
        : undefined}>
      {sales && sales.rows.length > 0 && (
        <Rows summary={sales} sym={sym} label={(r) => monthName(r.target)} />
      )}
      {cash && cash.rows.length > 0 && (
        <>
          <p className="bento-note" style={{ marginTop: 16 }}>
            <strong>Cash plan, week 4.</strong> {cash.words}
          </p>
          <Rows summary={cash} sym={sym} label={(r) => `Money on ${dayWords(r.target)}`} />
        </>
      )}
    </BentoCard>
  );
}
