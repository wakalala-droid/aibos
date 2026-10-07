'use client';
/**
 * Rooms & Stays: the calendar as a week (the owner's reference, 7 Oct 2026).
 *
 * Monday to Sunday across the top with each day's number large, one lane per
 * unit, and every stay a solid block across the nights it holds. Pointing at a
 * block shows the stay in a card; pressing it opens the full booking. A panel
 * on the right carries the month at a glance, the two places an owner starts
 * from (a new booking, a guest's name) and which units are on show.
 *
 * The page owns the data and the booking panel. This draws the week and says
 * what was pressed. Only stays that hold their nights reach it: the page leaves
 * out anything cancelled, turned down, or a request whose hold has lapsed.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, Plus, Search, UserRound, Users, X } from 'lucide-react';
import { fmt } from '@/lib/currency';
import { listBookings, nights, bookingSymbol, SOURCE_LABEL, type Booking, type Unit } from '@/lib/hospitality';

// ── Dates (browser zone, CAT for Lusaka) ────────────────────────────────────
const DAY_MS = 86_400_000;
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseISO = (s: string) => new Date(s + 'T00:00:00');
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** The Monday of the week a day falls in. Weeks here start on Monday, as they
 *  do on a Zambian wall calendar and in the owner's reference. */
export const weekStartOf = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
export const monthOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
/** The month a week belongs to: the one holding its Thursday, so a week of
 *  five October days and two September days reads as October. */
export const monthOfWeek = (weekStart: Date) => monthOf(addDays(weekStart, 3));
/** The first and last day the small month shows (whole weeks, Monday first). */
export const monthGrid = (month: Date) => {
  const start = weekStartOf(month);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const rows = Math.ceil(((month.getDay() + 6) % 7 + days) / 7);
  return { start, rows, end: addDays(start, rows * 7) };
};

const dayName = (d: Date) => d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = (s: string) => parseISO(s).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

function weekTitle(first: Date, last: Date): string {
  if (first.getMonth() === last.getMonth()) return first.toLocaleDateString([], { month: 'long', year: 'numeric' });
  if (first.getFullYear() === last.getFullYear()) {
    return `${first.toLocaleDateString([], { month: 'short' })} to ${last.toLocaleDateString([], { month: 'short', year: 'numeric' })}`;
  }
  return `${first.toLocaleDateString([], { month: 'short', year: 'numeric' })} to ${last.toLocaleDateString([], { month: 'short', year: 'numeric' })}`;
}

// ── Reading a stay ──────────────────────────────────────────────────────────
const guestName = (b: Booking) => (b.guest?.full_name || b.guest_name || '').trim();
const blockName = (b: Booking) => guestName(b) || (b.channel_id ? 'Booked on a channel' : 'No name given');
const sourceOf = (b: Booking) => (b.source ? SOURCE_LABEL[b.source] : b.channel_id ? SOURCE_LABEL.ota : SOURCE_LABEL.direct);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const nightsWord = (n: number) => `${n} night${n === 1 ? '' : 's'}`;

const STATUS_WORD: Record<string, string> = {
  confirmed: 'Confirmed',
  pending: 'Waiting for your answer',
  completed: 'Stay finished',
  // Never on the week, but a search finds them.
  cancelled: 'Cancelled',
  declined: 'Turned down',
  no_show: 'Never arrived',
};
const PAID_WORD: Record<string, string> = {
  unpaid: 'Not paid yet', partial: 'Part paid', paid: 'Paid in full', refunded: 'Refunded',
};

/** A stay laid on the week: where it starts, how many nights it covers here,
 *  which line of its lane it sits on, and whether it runs past either edge. */
interface Placed { b: Booking; col: number; span: number; row: number; fromBefore: boolean; toAfter: boolean }

/** Lay one unit's stays across the week. Two stays never share a unit's night
 *  in a healthy book, but a channel feed can deliver a clash, and a clash
 *  drawn on top of itself hides one guest. Each overlap gets its own line. */
function placeLane(stays: Booking[], weekStart: Date): { placed: Placed[]; rows: number } {
  const ws = weekStart.getTime();
  const we = addDays(weekStart, 7).getTime();
  const items = stays.flatMap(b => {
    const ci = parseISO(b.check_in).getTime();
    const co = parseISO(b.check_out).getTime();
    if (!(ci < we && co > ws)) return [];
    const start = Math.max(ci, ws);
    const end = Math.min(co, we);
    return [{
      b,
      col: Math.round((start - ws) / DAY_MS),
      span: Math.max(1, Math.round((end - start) / DAY_MS)),
      fromBefore: ci < ws,
      toAfter: co > we,
    }];
  }).sort((a, z) => a.col - z.col || z.span - a.span);
  const freeFrom: number[] = [];
  const placed = items.map(it => {
    let row = freeFrom.findIndex(f => f <= it.col);
    if (row === -1) { row = freeFrom.length; freeFrom.push(0); }
    freeFrom[row] = it.col + it.span;
    return { ...it, row };
  });
  return { placed, rows: Math.max(1, freeFrom.length) };
}

const HIDDEN_KEY = 'aibos.rooms.hiddenUnits';

export interface WeekCalendarProps {
  units: Unit[];
  /** Stays that hold their nights. */
  stays: Booking[];
  weekStart: Date;
  onWeekStart: (monday: Date) => void;
  /** The first of the month the small calendar shows. */
  month: Date;
  onMonth: (first: Date) => void;
  selectedId?: string | null;
  loading?: boolean;
  /** "K850 a night", in the unit's own currency. */
  rate: (u: Unit) => string;
  onOpen: (b: Booking) => void;
  /** A stay found by name: the page moves the week to it and opens it. */
  onJump: (b: Booking) => void;
  onNew: (unitId: string, day?: Date) => void;
}

export default function WeekCalendar({
  units, stays, weekStart, onWeekStart, month, onMonth, selectedId, loading, rate, onOpen, onJump, onNew,
}: WeekCalendarProps) {
  // Narrow by the calendar's own width, the same measure its CSS uses
  // (@container), so the words chosen here always fit the layout drawn.
  const frameRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const todayIso = iso(new Date());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const unitName = (id: string) => units.find(u => u.id === id)?.unit_name ?? 'Unit';

  // Units the owner has switched off, kept on this device. A property with
  // twelve rooms and one cleaner checks two of them; the rest is noise.
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) || '[]');
      if (Array.isArray(saved)) setHidden(saved.filter((x): x is string => typeof x === 'string'));
    } catch { /* a private window starts with every unit on */ }
  }, []);
  const toggleUnit = (id: string) => {
    setHidden(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* the choice still holds until reload */ }
      return next;
    });
  };
  const shown = units.filter(u => !hidden.includes(u.id));

  const lanes = useMemo(() => {
    const byUnit = new Map<string, Booking[]>();
    for (const b of stays) byUnit.set(b.unit_id, [...(byUnit.get(b.unit_id) ?? []), b]);
    return new Map(units.map(u => [u.id, placeLane(byUnit.get(u.id) ?? [], weekStart)]));
  }, [stays, units, weekStart]);

  /** Nights booked this week, per unit, for the list on the right. */
  const bookedNights = (unitId: string) => {
    const taken = new Set<number>();
    for (const p of lanes.get(unitId)?.placed ?? []) for (let i = 0; i < p.span; i++) taken.add(p.col + i);
    return taken.size;
  };

  /** Days a guest arrives, for the dots on the small month. */
  const arrivals = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of stays) m.set(b.check_in, (m.get(b.check_in) ?? 0) + 1);
    return m;
  }, [stays]);

  // ── The card on hover ─────────────────────────────────────────────────────
  const mainRef = useRef<HTMLDivElement>(null);
  const [peek, setPeek] = useState<{ b: Booking; top: number; left: number; below: boolean } | null>(null);
  const showPeek = (b: Booking, el: HTMLElement) => {
    const host = mainRef.current;
    if (!host) return;
    const h = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // Above the block, as in the reference, unless the week's header is in
    // the way: then under it.
    const below = r.top - h.top < 200;
    const left = Math.min(Math.max(r.left - h.left + 8, 0), Math.max(0, h.width - 360));
    setPeek({ b, left, top: below ? r.bottom - h.top + 8 : r.top - h.top - 8, below });
  };
  useEffect(() => { setPeek(null); }, [weekStart]);

  // ── Moving through time ─────────────────────────────────────────────────
  const goWeek = (monday: Date) => { onWeekStart(monday); onMonth(monthOfWeek(monday)); };
  const goDay = (d: Date) => { onWeekStart(weekStartOf(d)); onMonth(monthOf(d)); };
  const thisWeek = iso(weekStartOf(new Date())) === iso(weekStart);

  // ── Finding a guest ─────────────────────────────────────────────────────
  const [finding, setFinding] = useState(false);
  const [term, setTerm] = useState('');
  const [found, setFound] = useState<Booking[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [findError, setFindError] = useState('');
  const findRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (finding) findRef.current?.focus(); }, [finding]);

  const runFind = async () => {
    const q = term.trim();
    if (!q) return;
    setSearching(true); setFindError('');
    try {
      const all = await listBookings({ search: q, order: 'check_in', newestFirst: true });
      // Stays still to come first, soonest at the top; then the ones already
      // over, latest first. That is the order an owner looks for a name in.
      const ahead = all.filter(b => b.check_out > todayIso).sort((a, z) => a.check_in.localeCompare(z.check_in));
      const over = all.filter(b => b.check_out <= todayIso).sort((a, z) => z.check_in.localeCompare(a.check_in));
      setFound([...ahead, ...over]);
    } catch (e) {
      setFindError(e instanceof Error ? e.message : 'Could not search your bookings.');
    } finally {
      setSearching(false);
    }
  };
  const closeFind = () => { setFinding(false); setTerm(''); setFound(null); setFindError(''); };

  const grid = monthGrid(month);
  const miniDays = Array.from({ length: grid.rows * 7 }, (_, i) => addDays(grid.start, i));
  const weekIso = iso(weekStart);

  return (
    // title="" keeps the card's "hold to explain" tooltip off the calendar,
    // where it would sit on top of the stay card shown on hover.
    <div className="wk-frame" ref={frameRef} title="">
      <div className="wk">
        <div className="wk-main" ref={mainRef} onMouseLeave={() => setPeek(null)}>
          {/* Arrows and the month, as in the reference */}
          <div className="wk-head">
            <div className="wk-nav">
              <button type="button" className="wk-round" aria-label="Previous week" onClick={() => goWeek(addDays(weekStart, -7))}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className="wk-round" aria-label="Next week" onClick={() => goWeek(addDays(weekStart, 7))}>
                <ChevronRight aria-hidden="true" />
              </button>
              <h2 className="wk-title">{weekTitle(days[0], days[6])}</h2>
              {loading && <span className="wk-loading">Loading…</span>}
            </div>
            <div className="wk-head-actions">
              {!thisWeek && (
                <button type="button" className="pill pill-quiet" onClick={() => goDay(new Date())}>Today</button>
              )}
              {/* The panel's New booking button sits under the week when the
                  card is narrow, so the header carries its own. */}
              <button type="button" className="pill pill-primary wk-head-new" onClick={() => onNew('')}>
                <Plus aria-hidden="true" /> Booking
              </button>
            </div>
          </div>

          <div className="wk-grid">
            {/* Days */}
            <div className="wk-row wk-days">
              <div className="wk-gutter" aria-hidden="true" />
              {days.map(d => {
                const today = iso(d) === todayIso;
                return (
                  <div key={iso(d)} className={`wk-dayhead${today ? ' is-today' : ''}`} aria-label={today ? `Today, ${dayName(d)}` : dayName(d)}>
                    <span className="wk-dow" aria-hidden="true">
                      <span className="wk-dow-long">{d.toLocaleDateString([], { weekday: 'short' })}</span>
                      <span className="wk-dow-short">{d.toLocaleDateString([], { weekday: 'narrow' })}</span>
                    </span>
                    <span className="wk-dnum" aria-hidden="true">{d.getDate()}</span>
                  </div>
                );
              })}
            </div>

            {/* One lane per unit */}
            {shown.map(u => {
              const lane = lanes.get(u.id) ?? { placed: [], rows: 1 };
              return (
                <div key={u.id} className="wk-row wk-lanerow" role="group" aria-label={u.unit_name}>
                  <div className="wk-unit">
                    <span className="wk-unit-name" title={u.unit_name}>{u.unit_name}</span>
                    <span className="wk-unit-rate">{rate(u)}</span>
                  </div>
                  <div className="wk-lane" style={{ gridTemplateRows: `repeat(${lane.rows}, var(--wk-lane))` }}>
                    {days.map((d, i) => {
                      const key = iso(d);
                      return (
                        <button
                          key={key}
                          type="button"
                          tabIndex={-1}
                          className={`wk-cell${key === todayIso ? ' is-today' : ''}${key < todayIso ? ' is-past' : ''}`}
                          style={{ gridColumn: i + 1 }}
                          aria-label={`Book ${u.unit_name} from ${dayName(d)}`}
                          onClick={() => onNew(u.id, d)}
                        >
                          <Plus aria-hidden="true" />
                        </button>
                      );
                    })}
                    {lane.placed.map(p => {
                      const { b } = p;
                      const name = blockName(b);
                      const n = nights(b);
                      const waiting = b.status === 'pending';
                      const open = b.id === selectedId;
                      const sub = waiting
                        ? 'Needs your answer'
                        : !p.fromBefore && b.arrival_time
                          ? `Arrives ${String(b.arrival_time).slice(0, 5)}`
                          : sourceOf(b);
                      // One night is one narrow column: the name takes two lines
                      // there and the rest waits for the card on hover.
                      const narrow = p.span === 1;
                      const cls = [
                        'wk-block',
                        narrow && 'is-narrow',
                        waiting && 'is-wait',
                        b.status === 'completed' && 'is-done',
                        open && 'is-open',
                        p.fromBefore && 'from-before',
                        p.toAfter && 'to-after',
                      ].filter(Boolean).join(' ');
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={cls}
                          style={{ gridColumn: `${p.col + 1} / span ${p.span}`, gridRow: p.row + 1 }}
                          aria-label={`${name}, ${unitName(b.unit_id)}, ${STATUS_WORD[b.status] ?? b.status}, ${shortDay(b.check_in)} to ${shortDay(b.check_out)}, ${nightsWord(n)}`}
                          aria-describedby={peek?.b.id === b.id ? 'wk-peek' : undefined}
                          aria-pressed={open}
                          onMouseEnter={e => showPeek(b, e.currentTarget)}
                          onFocus={e => showPeek(b, e.currentTarget)}
                          onBlur={() => setPeek(null)}
                          onClick={() => { setPeek(null); onOpen(b); }}
                        >
                          <span className="wk-block-name">{compact && narrow ? initials(name) : name}</span>
                          {!narrow && <span className="wk-block-sub">{sub}</span>}
                          {/* "4 NIGHTS" needs about three phone columns. */}
                          {!narrow && !(compact && p.span < 3) && <span className="wk-block-meta">{nightsWord(n)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {shown.length === 0 && (
              <p className="wk-empty">
                Every unit is switched off. Tick one under Your units to see its week.
              </p>
            )}
          </div>

          {/* What the blocks mean, and where the money goes */}
          <div className="wk-foot">
            <span className="wk-key"><i className="wk-key-stay" aria-hidden="true" />Confirmed</span>
            <span className="wk-key"><i className="wk-key-wait" aria-hidden="true" />Waiting for your answer</span>
            <span className="wk-key"><i className="wk-key-done" aria-hidden="true" />Stay finished</span>
            <span className="wk-key"><i className="wk-key-open" aria-hidden="true" />Open below</span>
            <span className="wk-foot-note">
              Confirmed bookings post to your books:{' '}
              <Link className="tap-link" href="/dashboard/cash" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Money</Link>
              {' · '}
              <Link className="tap-link" href="/dashboard/timeline" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Activity</Link>
            </span>
          </div>

          {/* The card on hover: who, when, where, and the money */}
          {peek && (() => {
            const b = peek.b;
            const symbol = bookingSymbol(b);
            const earns = (b.status === 'confirmed' || b.status === 'completed') && (b.total_amount || 0) > 0;
            const people = `${b.guests_count || 1} guest${(b.guests_count || 1) === 1 ? '' : 's'}`;
            return (
              <div id="wk-peek" role="tooltip" className={`wk-pop${peek.below ? ' below' : ''}`} style={{ top: peek.top, left: peek.left }}>
                <div className="wk-pop-title">{blockName(b)}</div>
                <div className="wk-pop-line">{shortDay(b.check_in)} to {shortDay(b.check_out)} · {nightsWord(nights(b))}</div>
                <div className="wk-pop-line"><MapPin aria-hidden="true" />{unitName(b.unit_id)} · {sourceOf(b)}</div>
                <div className="wk-pop-line">
                  <UserRound aria-hidden="true" />
                  {people}{b.arrival_time ? ` · arrives from ${String(b.arrival_time).slice(0, 5)}` : ''}
                </div>
                <div className="wk-pop-foot">
                  <span className="wk-pop-status">{STATUS_WORD[b.status] ?? b.status}</span>
                  <span>{fmt(b.total_amount || 0, false, symbol)}{earns ? ` · ${PAID_WORD[b.payment_status] ?? ''}` : ''}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* The panel: the month, the two starting points, the units */}
        <aside className="wk-side" aria-label="Calendar tools">
          <div className="wk-mini">
            <div className="wk-mini-head">
              <span className="wk-mini-title">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
              <span className="wk-mini-nav">
                <button type="button" aria-label="Previous month" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button type="button" aria-label="Next month" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                  <ChevronRight aria-hidden="true" />
                </button>
              </span>
            </div>
            <div className="wk-mini-grid">
              {days.map(d => (
                <span key={`h${iso(d)}`} className="wk-mini-dow" aria-hidden="true">{d.toLocaleDateString([], { weekday: 'narrow' })}</span>
              ))}
              {miniDays.map((d, i) => {
                const key = iso(d);
                const count = arrivals.get(key) ?? 0;
                const inWeek = iso(weekStartOf(d)) === weekIso;
                const cls = [
                  'wk-mini-day',
                  d.getMonth() !== month.getMonth() && 'is-out',
                  key === todayIso && 'is-today',
                  inWeek && 'in-week',
                  inWeek && i % 7 === 0 && 'is-mon',
                  inWeek && i % 7 === 6 && 'is-sun',
                  count > 0 && 'has-arrival',
                ].filter(Boolean).join(' ');
                return (
                  <button
                    key={key}
                    type="button"
                    className={cls}
                    aria-label={`${dayName(d)}${count ? `, ${count} arriving` : ''}`}
                    aria-current={key === todayIso ? 'date' : undefined}
                    onClick={() => goDay(d)}
                  >
                    <span>{d.getDate()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="wk-side-rest">
            <button type="button" className="wk-action is-primary" onClick={() => onNew('')}>
              <CalendarPlus aria-hidden="true" /> New booking
            </button>
            <button type="button" className="wk-action" aria-expanded={finding} onClick={() => (finding ? closeFind() : setFinding(true))}>
              <Users aria-hidden="true" /> Find a guest
            </button>

            {finding && (
              <div className="wk-find">
                <div className="wk-find-row">
                  <input
                    ref={findRef}
                    className="field"
                    value={term}
                    onChange={e => setTerm(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') runFind(); if (e.key === 'Escape') closeFind(); }}
                    placeholder="Name or phone"
                    aria-label="Find a guest's stay"
                  />
                  <button type="button" className="icon-pill" aria-label="Search" disabled={searching || !term.trim()} onClick={runFind}>
                    <Search aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-pill" aria-label="Close the search" onClick={closeFind}>
                    <X aria-hidden="true" />
                  </button>
                </div>
                {searching && <p className="wk-find-note">Looking…</p>}
                {findError && <p className="wk-find-note is-bad" role="alert">{findError}</p>}
                {found && !searching && (
                  found.length === 0 ? (
                    <p className="wk-find-note">No stay under that name, phone or reference.</p>
                  ) : (
                    <div className="wk-found">
                      {found.slice(0, 6).map(b => (
                        <button key={b.id} type="button" className="wk-found-item" onClick={() => onJump(b)}>
                          <span className="wk-found-name">{blockName(b)}</span>
                          <span className="wk-found-line">{shortDay(b.check_in)} to {shortDay(b.check_out)}</span>
                          <span className="wk-found-line">{unitName(b.unit_id)} · {STATUS_WORD[b.status] ?? b.status}</span>
                        </button>
                      ))}
                      {found.length > 6 && (
                        <p className="wk-find-note">
                          {found.length - 6} more.{' '}
                          <Link href="/dashboard/hospitality/bookings" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>See them on the Bookings list</Link>
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            <div className="wk-units">
              <h3 className="wk-units-title">Your units</h3>
              {units.map(u => {
                const on = !hidden.includes(u.id);
                const taken = bookedNights(u.id);
                return (
                  <label key={u.id} className="wk-unit-toggle">
                    <input type="checkbox" checked={on} onChange={() => toggleUnit(u.id)} />
                    <span style={{ minWidth: 0 }}>
                      <span className="wk-unit-toggle-name">{u.unit_name}</span>
                      <span className="wk-unit-toggle-sub">
                        {taken === 0 ? 'Free all week' : taken === 7 ? 'Full all week' : `${taken} of 7 nights booked`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
