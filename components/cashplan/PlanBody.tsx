'use client';

// The Growth cash plan's body (16 Oct 2026): the four figures, the 13-week
// fan, what fixes a shortfall, week by week with what is due in each, where
// the 13 weeks come from, money owed, regular payments, a decision tried on
// the plan, all the owner's businesses together and how it was worked out.
// app/dashboard/cash-plan/page.tsx reads the plan and gates it.

import Link from 'next/link';
import { CalendarRange, HandCoins, Repeat, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import Panel from '@/components/home/Panel';
import Stat from '@/components/ui/Stat';
import BentoCard from '@/components/ui/BentoCard';
import { DayBadge, Note } from '@/components/hospitality/kit';
import PlanChart, { dayWords } from '@/components/cashplan/PlanChart';
import DecisionPanel from '@/components/cashplan/DecisionPanel';
import ChaseList from '@/components/cashplan/ChaseList';
import type { CashGroup, CashPlan, PlanWeek } from '@/lib/api';
import { fmt } from '@/lib/utils';
import { BAD, signTone } from '@/lib/tone';

const CADENCE: Record<string, string> = { monthly: 'Every month', weekly: 'Every week', fortnightly: 'Every two weeks' };
const SOURCE: Record<string, string> = { waiting: 'Waiting to be paid', schedule: 'On your Schedule', regular: 'Usually paid' };

export function teaser(plan: CashPlan | null): { headline: string; detail: string } {
  const detail = 'Every bill AIBOS knows is coming (wages, ZRA, rent), what customers owe and when they usually pay, '
    + 'the chance you run short each week, what is safe to spend today and what fixes a shortfall.';
  if (!plan?.ok) {
    return { headline: plan?.reason || 'See your money day by day for the next 13 weeks.', detail };
  }
  if (plan.at_risk) {
    const sure = (plan.chance_short_pct ?? 0) >= 99.5;
    const when = plan.first_risk_date ? `, first in the week of ${dayWords(plan.first_risk_date)}` : ' in the next 13 weeks';
    return {
      headline: sure
        ? `AIBOS sees your money going below zero${when}. See why and what fixes it.`
        : `AIBOS sees a ${plan.chance_words} chance your money goes below zero${when}. See why and what fixes it.`,
      detail,
    };
  }
  return { headline: 'Your 13-week cash plan is ready: see what is safe to spend today and every bill coming.', detail };
}

function WeekRow({ w, sym, open, onToggle }: { w: PlanWeek; sym: string; open: boolean; onToggle: () => void }) {
  const risky = w.chance_short_pct >= 20;
  return (
    <li style={{ listStyle: 'none' }}>
      <button type="button" className="row" onClick={onToggle} aria-expanded={open}
        style={{ width: 'calc(100% + 20px)', border: 0, background: 'transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <DayBadge date={w.start} tone={risky ? 'bad' : 'stay'} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="row-title" style={{ display: 'block' }}>Week of {dayWords(w.start)}</span>
          <span className="row-sub" style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            In {fmt(w.in, true, sym)}, out {fmt(w.out, true, sym)}
            {w.items.length ? `, ${w.items.length} payment${w.items.length === 1 ? '' : 's'} known` : ''}
            {w.chance_short_pct >= 5 ? `. ${Math.round(w.chance_short_pct)}% chance of running short` : ''}
          </span>
        </span>
        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          <span className="row-amount" style={{ display: 'block', color: signTone(w.close_p50) }}>{fmt(w.close_p50, true, sym)}</span>
          <span className="tnum" style={{ display: 'block', fontSize: 'var(--fs-label)', color: w.low_p10 < 0 ? BAD : 'var(--text-3)' }}>
            cautious {fmt(w.close_p10, true, sym)}
          </span>
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 0 16px 70px' }}>
          {w.items.length === 0 ? (
            <p className="rs-text is-quiet">No bills or payments known this week: only everyday trade.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {w.items.map((it) => (
                <li key={it.id} style={{ listStyle: 'none', display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span className="tnum" style={{ width: 56, color: 'var(--text-3)', fontSize: 'var(--fs-label)' }}>{dayWords(it.day)}</span>
                  <span style={{ flex: 1, minWidth: 140, fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>
                    {it.label}
                    <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                      {SOURCE[it.source] ?? ''}{it.source === 'regular' && it.chance ? `, ${it.chance}% sure` : ''}
                    </span>
                  </span>
                  <span className="row-amount">{it.dir === 'in' ? '+' : '-'}{fmt(it.amount, false, sym)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export default function PlanBody({ plan, sym, floor, floorText, setFloorText, setFloor, tried, setTried, decisionLine, open, setOpen, group }: {
  plan: CashPlan; sym: string; floor: number; floorText: string; setFloorText: (s: string) => void;
  setFloor: (n: number) => void; tried: CashPlan | null; setTried: (p: CashPlan | null) => void;
  decisionLine: number[] | null; open: number | null; setOpen: (n: number | null) => void; group: CashGroup | null;
}) {
  const p = plan as Required<Pick<CashPlan, 'weeks' | 'daily' | 'lowest' | 'close' | 'drivers'>> & CashPlan;
  const short = p.chance_short_pct ?? 0;
  const risky = short >= 5;
  const salesAcc = p.accuracy?.sales_w;
  const spendAcc = p.accuracy?.out_w;
  const applyFloor = () => {
    const n = Math.max(0, Number(floorText.replace(/[^0-9.]/g, '')) || 0);
    setFloor(n);
  };

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <Stat label="Money now" money={p.cash_now ?? 0} sym={sym} sub="The money figure on your Money page" />
        <Stat label="Lowest point, likely" money={p.lowest.p50} sym={sym}
          sub={<>Around {dayWords(p.lowest.day)}. Cautious: <span className="tnum" style={{ whiteSpace: 'nowrap' }}>{fmt(p.lowest.p10, true, sym)}</span></>}
          tone={p.lowest.p10 < floor ? 'bad' : undefined} />
        {typeof p.safe_to_spend === 'number' ? (
          <Stat label="Safe to spend today" money={p.safe_to_spend} sym={sym}
            sub={`And still stay above ${floor ? fmt(floor, true, sym) : 'zero'} on 9 in 10 futures`} tone="good" />
        ) : (
          <Stat label="Cash needed" money={p.cash_needed ?? 0} sym={sym}
            sub="To stay above the line on 9 in 10 futures" tone="bad" />
        )}
        <Stat label="Chance of running short" text={`${Math.round(short)}%`}
          sub={risky && p.first_risk_date ? `First risk: week of ${dayWords(p.first_risk_date)}` : 'In the next 13 weeks'}
          tone={short >= 20 ? 'bad' : short >= 5 ? 'warn' : 'good'} />
      </div>

      <Note tone={short >= 20 ? 'bad' : risky ? 'warn' : 'good'}>{p.headline}</Note>

      <div style={{ marginTop: 20 }}>
        <Panel title="The next 13 weeks" action={
          <form onSubmit={(e) => { e.preventDefault(); applyFloor(); }} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label htmlFor="cp-floor" className="quiet-label">Keep at least</label>
            <input id="cp-floor" className="field" inputMode="decimal" placeholder="0" value={floorText}
              onChange={(e) => setFloorText(e.target.value)} onBlur={applyFloor} style={{ width: 120 }} />
          </form>
        }>
          <PlanChart daily={p.daily} floor={floor} sym={sym} decision={decisionLine} />
          <p className="bento-note" style={{ marginTop: 12 }}>
            {p.weeks.length} weeks from {dayWords(p.today)} to {dayWords(p.until)}. Likely end: <strong>{fmt(p.close.p50, true, sym)}</strong>,
            cautious {fmt(p.close.p10, true, sym)}, hopeful {fmt(p.close.p90, true, sym)}.
          </p>
        </Panel>
      </div>

      {(p.levers ?? []).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Panel title="What fixes it">
            <p className="rs-text is-quiet" style={{ marginBottom: 8 }}>
              Each one tried on the same futures as your plan. Never wages or ZRA late: AIBOS does not suggest that.
            </p>
            <ul style={{ margin: 0, padding: 0 }}>
              {(p.levers ?? []).map((lv) => (
                <li key={lv.key} className="row" style={{ listStyle: 'none', alignItems: 'flex-start' }}>
                  <span className="bento-icon" aria-hidden="true" style={{ width: 44, height: 44 }}>
                    {lv.key === 'collect' ? <HandCoins /> : lv.key === 'spend' ? <Scale /> : lv.key === 'faster' ? <Sparkles /> : <CalendarRange />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="row-title" style={{ display: 'block' }}>{lv.title}</span>
                    <span className="row-sub" style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{lv.detail}</span>
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="row-amount" style={{ display: 'block' }}>{Math.round(lv.chance_short_pct)}%</span>
                    <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>chance of running short</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <div className="grid-main" style={{ marginTop: 20, alignItems: 'start' }}>
        <Panel title="Week by week">
          <ul style={{ margin: 0, padding: 0 }}>
            {p.weeks.map((w) => (
              <WeekRow key={w.week} w={w} sym={sym} open={open === w.week}
                onToggle={() => setOpen(open === w.week ? null : w.week)} />
            ))}
          </ul>
        </Panel>
        <div style={{ display: 'grid', gap: 20 }}>
          <Panel title="Where the 13 weeks come from">
            <div style={{ display: 'grid', gap: 2 }}>
              {([
                ['Sales paid on the spot', p.drivers.sales, 1],
                ['Money owed now, collected', p.drivers.debts_collected, 1],
                ['New credit sales, collected', p.drivers.new_credit_collected, 1],
                ['Other money known to be coming', p.drivers.known_in, 1],
                ['Everyday spending', p.drivers.spending, -1],
                ['Regular payments', p.drivers.regular_bills, -1],
                ['Bills already known', p.drivers.known_out, -1],
              ] as [string, number, number][]).filter(([, v]) => v > 0.5).map(([name, v, sign]) => (
                <div key={name} className="row" style={{ minHeight: 44 }}>
                  <span style={{ flex: 1, fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>{name}</span>
                  <span className="row-amount">{sign > 0 ? '+' : '-'}{fmt(v, true, sym)}</span>
                </div>
              ))}
            </div>
            <p className="bento-note" style={{ marginTop: 8 }}>On the average future, added up over the 13 weeks.</p>
          </Panel>

          {(p.chase ?? []).length > 0 ? (
            <ChaseList rows={p.chase ?? []} sym={sym} />
          ) : (p.debts ?? []).length > 0 && (
            <Panel title="Money owed to you">
              <ul style={{ margin: 0, padding: 0 }}>
                {(p.debts ?? []).slice(0, 8).map((d) => (
                  <li key={d.ref} className="row" style={{ listStyle: 'none' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="row-title" style={{ display: 'block' }}>{d.customer}</span>
                      <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                        {d.label}{d.likely_by ? `, likely by ${dayWords(d.likely_by)}` : ''}, {d.chance_in_plan_pct}% within 13 weeks
                      </span>
                    </span>
                    <span className="row-amount">{fmt(d.amount, false, sym)}</span>
                  </li>
                ))}
              </ul>
              <Link className="pill pill-quiet" href="/dashboard/invoices" style={{ marginTop: 12 }}>Chase what is owed</Link>
            </Panel>
          )}

          {(p.regular ?? []).length > 0 && (
            <Panel title="Regular payments AIBOS found" action={<span className="bento-icon" aria-hidden="true" style={{ width: 44, height: 44 }}><Repeat /></span>}>
              <ul style={{ margin: 0, padding: 0 }}>
                {(p.regular ?? []).slice(0, 10).map((r) => (
                  <li key={r.key} className="row" style={{ listStyle: 'none' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="row-title" style={{ display: 'block' }}>{r.label}</span>
                      <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                        {CADENCE[r.cadence] ?? r.cadence}{r.next?.[0] ? `, next ${dayWords(r.next[0])}` : ''}
                      </span>
                    </span>
                    <span className="row-amount">{fmt(r.amount, false, sym)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <DecisionPanel floor={floor} sym={sym} onResult={setTried} />
        {tried && <span className="sr-only" aria-live="polite">{tried.scenario?.plan.headline}</span>}
      </div>

      {group?.ok && (group.businesses?.length ?? 0) > 1 && (
        <div style={{ marginTop: 20 }}>
          <Panel title="All your businesses">
            <p className="rs-text" style={{ marginBottom: 12 }}>
              Together you hold <strong>{fmt(group.cash_now ?? 0, true, sym)}</strong>. Chance the group runs short: <strong>{Math.round(group.chance_short_pct ?? 0)}%</strong>
              {typeof group.any_short_pct === 'number' && group.any_short_pct > (group.chance_short_pct ?? 0) + 1
                ? `; chance one of them does on its own: ${Math.round(group.any_short_pct)}%.` : '.'}
            </p>
            <ul style={{ margin: 0, padding: 0 }}>
              {(group.businesses ?? []).map((b) => (
                <li key={b.business_id} className="row" style={{ listStyle: 'none' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="row-title" style={{ display: 'block' }}>{b.name}</span>
                    <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: b.chance_short_pct >= 20 ? BAD : 'var(--text-3)' }}>
                      Now {fmt(b.cash_now, true, sym)}, {Math.round(b.chance_short_pct)}% chance of running short
                      {b.first_risk_week ? `, from week ${b.first_risk_week}` : ''}
                    </span>
                  </span>
                  <span className="row-amount" style={{ color: signTone(b.close_p50) }}>{fmt(b.close_p50, true, sym)}</span>
                </li>
              ))}
            </ul>
            {(group.moves ?? []).map((m) => <Note key={`${m.from}-${m.to}`} tone="info">{m.words}</Note>)}
            {(group.without_plan ?? []).length > 0 && (
              <p className="bento-note" style={{ marginTop: 12 }}>
                Not in the group plan yet: {(group.without_plan ?? []).map((b) => b.name).join(', ')} (not enough history).
              </p>
            )}
          </Panel>
        </div>
      )}

      <div className="bento-grid" style={{ marginTop: 20 }}>
        <BentoCard className="span-6" icon={<ShieldCheck />} title="How AIBOS worked this out" tag="Your books only"
          text={(p.assumptions ?? []).join(' ')}>
          {(salesAcc?.avg_miss_pct != null || spendAcc?.avg_miss_pct != null) && (
            <p className="bento-note" style={{ marginTop: 12 }}>
              Tested on your last {salesAcc?.tested ?? spendAcc?.tested} weeks:
              {salesAcc?.avg_miss_pct != null ? ` weekly sales missed by ${salesAcc.avg_miss_pct}% on average` : ''}
              {salesAcc?.avg_miss_pct != null && spendAcc?.avg_miss_pct != null ? ',' : ''}
              {spendAcc?.avg_miss_pct != null ? ` everyday spending by ${spendAcc.avg_miss_pct}%` : ''}.
            </p>
          )}
        </BentoCard>
      </div>
    </>
  );
}
