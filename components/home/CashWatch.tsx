'use client';

// The cash watch on Home (16 Oct 2026, second pass). The 13-week plan is
// worth most where the owner already looks every morning, so Home carries it
// in a glance: the headline, what is safe to spend (or the cash needed), the
// chance of running short, what is due out in the next two weeks and who to
// ask for money first, with the reminder ready. Below Growth the risk shows
// as an item in "Needs you" instead (components/home/useHomeDecisions.ts).
// Read from GET /forecast/cash-watch, which keeps the plan a few minutes for
// the same books and reads again the moment anything is recorded.

import Link from 'next/link';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import Panel from './Panel';
import { dayWords, floorWords } from '@/components/cashplan/PlanChart';
import { whatsAppLink } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useCashWatch } from '@/hooks/useCashWatch';
import { fmt } from '@/lib/utils';
import { BAD } from '@/lib/tone';

export default function CashWatch() {
  const storeSym = useStore((s) => s.currencySymbol) || 'K';
  const watch = useCashWatch();

  if (!watch?.ok) return null;
  const sym = watch.sym || storeSym;
  const short = watch.chance_short_pct ?? 0;
  // The line is the owner's cushion from Teach AIBOS when they gave one.
  const onCushion = watch.floor_from === 'cushion';
  const line = floorWords(watch.floor, onCushion, sym);

  // Below Growth the risk is one item in "Needs you" (17 Nov 2026), not a
  // card of its own: the owner has one place to look.
  if (watch.preview) return null;

  const tone = short >= 20 ? BAD : 'var(--text-1)';
  return (
    <Panel labelledBy="cash-watch-title" title={
      <h2 id="cash-watch-title" className="panel-title">Next 13 weeks</h2>
    } action={
      <Link href="/dashboard/cash-plan" className="icon-pill" aria-label="Open the cash plan"><ArrowUpRight aria-hidden="true" /></Link>
    }>
      <p className="rs-text" style={{ color: tone, fontWeight: short >= 5 ? 600 : 400 }}>{watch.headline}</p>
      <div className="mini-stats" style={{ marginTop: 14 }}>
        {typeof watch.safe_to_spend === 'number' ? (
          <div className="mini-stat">
            <span className="quiet-label">Safe to spend today</span>
            <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>{fmt(watch.safe_to_spend, true, sym)}</span>
            {onCushion && <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>keeping {line}</span>}
          </div>
        ) : (
          <div className="mini-stat">
            <span className="quiet-label">Cash needed</span>
            <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: BAD }}>{fmt(watch.cash_needed ?? 0, true, sym)}</span>
            {onCushion && <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>to keep {line}</span>}
          </div>
        )}
        <div className="mini-stat">
          <span className="quiet-label">Chance of running short</span>
          <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: tone }}>{Math.round(short)}%</span>
        </div>
        {watch.lowest && (
          <div className="mini-stat">
            <span className="quiet-label">Lowest point, likely</span>
            <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: watch.lowest.p50 < 0 ? BAD : undefined }}>
              {fmt(watch.lowest.p50, true, sym)}
            </span>
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>around {dayWords(watch.lowest.day)}</span>
          </div>
        )}
      </div>

      {(watch.coming ?? []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="quiet-label" style={{ margin: '0 0 6px' }}>Due out in the next two weeks</p>
          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {(watch.coming ?? []).map((c) => (
              <li key={`${c.day}-${c.label}`} style={{ listStyle: 'none', display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span className="tnum" style={{ width: 56, flexShrink: 0, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{dayWords(c.day)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>{c.label}</span>
                <span className="row-amount">{fmt(c.amount, false, sym)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {watch.chase_first && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p className="rs-text" style={{ flex: 1, minWidth: 220 }}>
            Ask <strong>{watch.chase_first.customer}</strong> for <strong>{fmt(watch.chase_first.amount, false, sym)}</strong> first.
          </p>
          {watch.chase_first.message && (
            <a className="pill pill-quiet" href={whatsAppLink(watch.chase_first.message, watch.chase_first.phone)}
              target="_blank" rel="noopener noreferrer" aria-label={`Send ${watch.chase_first.customer} a reminder on WhatsApp`}>
              <MessageCircle aria-hidden="true" /> Send a reminder
            </a>
          )}
        </div>
      )}
    </Panel>
  );
}
