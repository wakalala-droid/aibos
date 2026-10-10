'use client';

/**
 * The five scenes of the feature theatre (FeatureTheatre.tsx). Each is the
 * light product at work, built from the AI-BOS UI kit (Panel, Notice,
 * BigMoney, rows, pills, tags, the Rooms & Stays week calendar) and played by
 * a beat clock (useBeats): React only flips "is-on" on a few beats and the
 * kit's own timings in CSS do the moving (marketing.css, "Feature theatre").
 *
 * Every figure is the product's own:
 *   - Payroll: aibos-api/payroll.py at the 2026 ZMW rates. K8,500.00 gross
 *     pays NAPSA K425.00, PAYE K792.50 and NHIMA K85.00, so K7,197.50 home.
 *     The three staff (K8,500, K4,800, K6,200) make PAYE K990.00, NAPSA
 *     K1,950.00 and NHIMA K390.00 with both sides, due the 10th of next month.
 *   - Stock: lib/automation.ts tops up to twice the reorder level, so 2 left
 *     with a level of 6 drafts 10.
 *   - Rooms: K650 a night, a one-night deposit, three nights.
 */

import { BellRing, CalendarClock, Check, PackagePlus, Smartphone, Wallet } from 'lucide-react';
import { BigMoney, Notice, Panel } from '@/components/kit';
import { at, useBeats } from './useBeats';

export type SceneProps = { playing: boolean; still: boolean };

const press = (on: boolean) => (on ? ' is-press' : '');

/* ── Payroll ───────────────────────────────────────────────────── */
const STAFF = [
  { initials: 'MB', name: 'Mwila Banda', role: 'Head cook', pay: 'K8,500.00' },
  { initials: 'CP', name: 'Chipo Phiri', role: 'Server', pay: 'K4,800.00' },
  { initials: 'JT', name: 'Joseph Tembo', role: 'Driver', pay: 'K6,200.00' },
];
const PAYROLL_BEATS = [500, 750, 1250, 1650, 2050, 2450, 2950, 4300] as const;

export function PayrollScene({ playing, still }: SceneProps) {
  const b = useBeats(PAYROLL_BEATS, playing, still);
  const takeHome = b >= 6 ? 7197.5 : b >= 5 ? 7282.5 : b >= 4 ? 8075 : 8500;
  return (
    <div className="scn">
      <Panel title="Payroll · October" action={<span className={`pill pill-primary sc-pill${press(b === 1)}`}>Run payroll</span>}>
        {STAFF.map((s) => (
          <div key={s.name} className="row">
            <span className="avatar">{s.initials}</span>
            <span className="row-main"><span className="row-title">{s.name}</span><span className="row-sub">{s.role}</span></span>
            <span className="row-amount">{s.pay}</span>
          </div>
        ))}
      </Panel>

      <div className={at(b, 2, 'sc-in sc-sheet')}>
        <Notice floating icon={Wallet} title="Payslip · Mwila Banda" tag="October" role="region">
          <div className="sc-lines">
            <p className={at(b, 3, 'sc-in sc-line')}><span>Pay</span><span>K8,500.00</span></p>
            <p className={at(b, 4, 'sc-in sc-line')}><span>NAPSA, 5%</span><span>−K425.00</span></p>
            <p className={at(b, 5, 'sc-in sc-line')}><span>PAYE</span><span>−K792.50</span></p>
            <p className={at(b, 6, 'sc-in sc-line')}><span>NHIMA, 1%</span><span>−K85.00</span></p>
            <p className="sc-line sc-total"><span>Take-home</span><BigMoney value={takeHome} sym="K" size="md" roll /></p>
          </div>
          <p className={at(b, 7, 'sc-in sc-done')}><Check aria-hidden /> October&apos;s wages posted to your books</p>
        </Notice>
      </div>

      <div className={at(b, 8, 'sc-in sc-toast sc-from-right')}>
        <Notice floating icon={CalendarClock} title="On your schedule" tag="Due 10 Nov" role="region">
          PAYE <strong>K990.00</strong> to ZRA, NAPSA <strong>K1,950.00</strong> and NHIMA <strong>K390.00</strong>.
        </Notice>
      </div>
    </div>
  );
}

/* ── Get paid ──────────────────────────────────────────────────── */
const PAID_BEATS = [600, 850, 1500, 2700, 3000, 3300] as const;

export function GetPaidScene({ playing, still }: SceneProps) {
  const b = useBeats(PAID_BEATS, playing, still);
  const paid = b >= 5;
  return (
    <div className="scn">
      <Panel title="Invoice 0142" action={<span className="bento-tag sc-tag">{paid ? <><Check aria-hidden /> Paid</> : b >= 2 ? 'Sent' : 'Draft'}</span>}>
        <div className="row">
          <span className="avatar">LH</span>
          <span className="row-main"><span className="row-title">Lusaka Hotels</span><span className="row-sub">Catering for 3 events</span></span>
          <span className="row-amount">K4,800.00</span>
        </div>
        <div className="row">
          <span className="avatar"><Smartphone aria-hidden /></span>
          <span className="row-main"><span className="row-title">Mobile money payment link</span><span className="row-sub">{b >= 2 ? 'Sent to Lusaka Hotels' : 'Ready to send'}</span></span>
          <span className={`pill pill-primary sc-pill${press(b === 1)}`}>Send the link</span>
        </div>
      </Panel>

      <div className="sc-gap">
        <Panel title="Money right now">
          <BigMoney value={b >= 6 ? 53030.5 : 48230.5} sym="K" size="lg" roll />
        </Panel>
      </div>

      {/* What the customer sees on their phone: the invoice's own payment page. */}
      <div className={`sc-in sc-sheet${b >= 3 && b < 5 ? ' is-on' : ''}`}>
        <Notice floating icon={Smartphone} title="Pay Zoe's Kitchen" tag="Invoice 0142" role="region"
          actions={<span className={`pill pill-primary sc-pill${press(b === 4)}`}>Pay K4,800.00 by mobile money</span>}>
          Catering for 3 events. Lusaka Hotels pays from their own phone.
        </Notice>
      </div>

      {/* Rises where the payment page was, clear of the invoice's tag and the money figure. */}
      <div className={at(b, 5, 'sc-in sc-sheet')}>
        <Notice floating icon={Wallet} title="Lusaka Hotels paid" tag="Mobile money" role="region">
          <strong>K4,800.00</strong> for invoice 0142. Marked paid and in your books.
        </Notice>
      </div>
    </div>
  );
}

/* ── Deadlines ─────────────────────────────────────────────────── */
// The day badge of the Rooms & Stays kit (.rs-day), written out so the
// month never depends on the visitor's language settings.
const DUE = [
  { mon: 'Nov', day: 8, title: 'Supplier pick-up', sub: 'Kasama Traders at 07:30', amount: '' },
  { mon: 'Nov', day: 10, title: 'NAPSA for October', sub: 'Both sides, 3 staff', amount: 'K1,950.00', napsa: true },
  { mon: 'Nov', day: 10, title: 'PAYE to ZRA', sub: 'October', amount: 'K990.00' },
  { mon: 'Dec', day: 1, title: 'Rent', sub: 'East Park shop', amount: 'K6,500.00' },
];
const DUE_BEATS = [300, 550, 800, 1050, 2000, 3600, 3850, 4200] as const;

export function DeadlinesScene({ playing, still }: SceneProps) {
  const b = useBeats(DUE_BEATS, playing, still);
  const done = b >= 8;
  return (
    <div className="scn">
      <Panel title="Coming up">
        {DUE.map((d, i) => (
          <div key={d.title} className={at(b, i + 1, 'sc-in row')}>
            <span className="rs-day is-stay"><span className="rs-day-mon">{d.mon}</span><span className="rs-day-num">{d.day}</span></span>
            <span className="row-main"><span className="row-title">{d.title}</span><span className="row-sub">{d.sub}</span></span>
            {d.napsa && done
              ? <span className="bento-tag sc-tag"><Check aria-hidden /> Paid</span>
              : d.amount && <span className="row-amount">{d.amount}</span>}
          </div>
        ))}
      </Panel>

      <div className={`sc-in sc-toast sc-from-top${b >= 5 && !done ? ' is-on' : ''}`}>
        <Notice floating icon={BellRing} title="NAPSA due on Tuesday" tag="Reminder" role="region"
          actions={<>
            <span className={`pill pill-primary sc-pill${press(b === 6)}`}>Mark paid</span>
            <span className="pill pill-quiet">Remind me tomorrow</span>
          </>}>
          <strong>K1,950.00</strong> for October. Pay by 10 November so there is no penalty.
        </Notice>
      </div>
    </div>
  );
}

/* ── Stock ─────────────────────────────────────────────────────── */
const STOCK = [
  { name: 'Chicken, 10 kg', left: '14 left', fill: 70 },
  { name: 'Rice, 25 kg', left: '9 left', fill: 56 },
  { name: 'Charcoal', left: '18 bags left', fill: 82 },
];
const STOCK_BEATS = [400, 1700, 2300, 3700, 3950, 4300] as const;

export function StockScene({ playing, still }: SceneProps) {
  const b = useBeats(STOCK_BEATS, playing, still);
  const low = b >= 2;
  const drafted = b >= 6;
  return (
    <div className="scn">
      <Panel title="Stock">
        <div className="sc-stock">
          <div className="sc-stock-row">
            <span className="row-main">
              <span className="row-title">Cooking oil, 20 L</span>
              <span className={`row-sub${low && !drafted ? ' tone-bad' : ''}`}>
                {drafted ? '2 left · 10 arriving' : low ? '2 left · reorder level 6' : '6 left · reorder level 6'}
              </span>
            </span>
            <div className="meter sc-meter" aria-hidden="true">
              <span className={`meter-fill${low && !drafted ? ' bad' : ''}`} style={{ width: b >= 1 ? '20%' : '60%' }} />
              <span className="meter-mark" style={{ left: '60%' }} />
            </div>
          </div>
          {STOCK.map((s) => (
            <div key={s.name} className="sc-stock-row">
              <span className="row-main"><span className="row-title">{s.name}</span><span className="row-sub">{s.left}</span></span>
              <div className="meter sc-meter" aria-hidden="true"><span className="meter-fill" style={{ width: `${s.fill}%` }} /></div>
            </div>
          ))}
        </div>
      </Panel>

      {/* From the bottom, so the cooking oil line stays in view. */}
      <div className={at(b, 3, 'sc-in sc-sheet')}>
        {drafted ? (
          <Notice floating icon={Check} title="Reorder drafted" tag="Kasama Traders" role="region">
            <strong>10 × 20 L</strong> cooking oil. It waits under Expected deliveries until it arrives.
          </Notice>
        ) : (
          <Notice floating icon={PackagePlus} title="Cooking oil is low" tag="Reorder" role="region"
            actions={<>
              <span className={`pill pill-primary sc-pill${press(b === 4)}`}>Approve</span>
              <span className="pill pill-quiet">Not now</span>
            </>}>
            2 left, reorder level 6. Draft: <strong>10 × 20 L</strong> from Kasama Traders.
          </Notice>
        )}
      </div>
    </div>
  );
}

/* ── Rooms & Stays ─────────────────────────────────────────────── */
const DAYS = [['Wed', 14], ['Thu', 15], ['Fri', 16], ['Sat', 17], ['Sun', 18]] as const;
const ROOMS_BEATS = [500, 1800, 2600, 3800] as const;

function Cells() {
  return <>{DAYS.map((d, i) => <span key={d[0]} className={`wk-cell sc-cell${i === 0 ? ' is-today' : ''}`} style={{ gridColumn: i + 1 }} />)}</>;
}

export function RoomsScene({ playing, still }: SceneProps) {
  const b = useBeats(ROOMS_BEATS, playing, still);
  const confirmed = b >= 3;
  return (
    <div className="scn">
      <Panel title="Rooms & Stays · this week">
        <div className="wk-grid sc-wk">
          <div className="wk-row wk-days">
            <span />
            {DAYS.map(([dow, n], i) => (
              <div key={dow} className={`wk-dayhead${i === 0 ? ' is-today' : ''}`}>
                <span className="wk-dow">{dow}</span><span className="wk-dnum">{n}</span>
              </div>
            ))}
          </div>
          <div className="wk-row wk-lanerow">
            <div className="wk-unit"><span className="wk-unit-name">Room 1</span><span className="wk-unit-rate">K650</span></div>
            <div className="wk-lane"><Cells />
              <span className="wk-block is-narrow" style={{ gridColumn: '1 / 4', gridRow: 1 }}>
                <span className="wk-block-name">Banda</span><span className="wk-block-sub">3 nights</span>
              </span>
            </div>
          </div>
          <div className="wk-row wk-lanerow">
            <div className="wk-unit"><span className="wk-unit-name">Room 2</span><span className="wk-unit-rate">K650</span></div>
            <div className="wk-lane"><Cells />
              <span className={`wk-block is-narrow ${confirmed ? '' : 'is-wait '}${at(b, 1, 'sc-in')}`} style={{ gridColumn: '2 / 5', gridRow: 1 }}>
                <span className="wk-block-name">Mrs Tembo</span>
                <span className="wk-block-sub">{confirmed ? 'Deposit paid' : 'Request'}</span>
              </span>
            </div>
          </div>
          <div className="wk-row wk-lanerow">
            <div className="wk-unit"><span className="wk-unit-name">Chalet</span><span className="wk-unit-rate">K900</span></div>
            <div className="wk-lane"><Cells />
              <span className="wk-block is-narrow is-done" style={{ gridColumn: '1 / 2', gridRow: 1 }}>
                <span className="wk-block-name">Phiri</span>
              </span>
              {/* Friday to the last day shown: Sunday, or Saturday on a phone. */}
              <span className="wk-block is-narrow to-after" style={{ gridColumn: '3 / -1', gridRow: 1 }}>
                <span className="wk-block-name">Lungu</span><span className="wk-block-sub">4 nights</span>
              </span>
            </div>
          </div>
        </div>
      </Panel>

      {/* From the bottom, so the week's days and Mrs Tembo's stay stay in view. */}
      <div className={at(b, 2, 'sc-in sc-sheet')}>
        {b >= 4 ? (
          <Notice floating icon={BellRing} title="Mrs Tembo arrives Thursday" tag="Reminder" role="region">
            Room 2 for 3 nights. <strong>K1,300.00</strong> left to pay on arrival.
          </Notice>
        ) : (
          <Notice floating icon={Wallet} title="Deposit received" tag="Mobile money" role="region">
            Mrs Tembo paid <strong>K650.00</strong> through her payment link. Her stay is confirmed.
          </Notice>
        )}
      </div>
    </div>
  );
}
