'use client';
/**
 * AIBOS: Hospitality hub (short-let PMS).
 *
 * One screen to run the property day-to-day, per the build spec's north star:
 * the multi-unit availability calendar is the hero: the one place staff check
 * instead of opening Booking.com / RentByOwner / CASAI / FVRentals separately.
 *
 * Everything recorded here already lives inside AIBOS: a confirmed booking posts
 * a Sale and each expense posts an Expense to the event spine on the server, so the
 * numbers surface in Cash Intel, Timeline and the P&L with no extra entry. This page
 * keeps that promise visible (the "in your books" note) rather than feeling bolted on.
 *
 * The booking panel used to show six anonymous fields and one Cancel button, so a
 * request arrived with nobody's name on it and no way to say yes. It now shows the
 * whole booking (who, when, what, their words, the decision) and carries the two
 * buttons the job actually needs: Confirm and Decline. A "Needs your answer" band
 * sits at the top because a request for dates three weeks out is invisible inside a
 * one-week calendar, which is exactly how requests went unanswered.
 *
 * The calendar itself is a week (components/hospitality/WeekCalendar): Monday to
 * Sunday, one lane per unit, each stay a block across its nights, with the month,
 * New booking, Find a guest and the units in a panel beside it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { confirmSheet } from '@/lib/confirm';
import { CalendarDays, CalendarPlus, Check, Copy, Link2, Mail, MapPin, MessageCircle, Phone, Plus, UserRound, X } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import KPICard from '@/components/ui/KPICard';
import WeekCalendar, { weekStartOf, monthOf, monthGrid } from '@/components/hospitality/WeekCalendar';
import { Chip, DayBadge, Fact, Facts, Note, Section, Segmented, toneOf } from '@/components/hospitality/kit';
import LockedPreviewCard from '@/components/ui/LockedPreviewCard';
import { useStore } from '@/lib/store';
import { canAccess, requiredTier, TIERS, type Tier } from '@/lib/tiers';
import { fmt, symbolForToken } from '@/lib/currency';
import {
  listProperties, listUnits, listBookings, getBooking, createBooking, cancelBooking, updateBooking,
  confirmBooking, declineBooking, createProperty, createUnit, createGuest, guestEmailOutcome,
  createStayPayLink, listStayPayments, addStayPayment, removeStayPayment,
  type StayPayment, type StayPaymentMethod,
  occupancyRate, nights, bookingSymbol, SOURCE_LABEL, isDatesTaken,
  type Property, type Unit, type Booking, type BookingStatus, type PaymentStatus,
} from '@/lib/hospitality';

// ── Date helpers (browser zone: CAT for Lusaka) ─────────────────────────────
const DAY_MS = 86_400_000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s: string) => new Date(s + 'T00:00:00');
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Dates an owner reads out loud: the weekday is the part they check against
 *  their own week, so it never gets dropped. */
const longDate = (s: string) => parseISO(s).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (s: string) => parseISO(s).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

/** A server timestamp in words. Falls back to the raw value rather than showing
 *  "Invalid Date" if the API ever hands back something unexpected. */
const stamp = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Turn an API token (walk_in, mobile_money) into something readable. */
const sentence = (s?: string | null) => {
  const t = (s ?? '').trim().replace(/_/g, ' ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
};

// Status in words. Its look is the calendar's fill (toneOf in the kit). Keyed on
// the plain string because the API also answers 'declined' for a request that
// was never agreed to, which the shared BookingStatus union does not carry yet.
const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  pending:  'Waiting for your answer',
  completed: 'Stay finished',
  cancelled: 'Cancelled',
  declined: 'Turned down',
  no_show:  'Never arrived',
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? sentence(s);

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid:  'Not paid yet',
  partial: 'Part paid',
  paid:    'Paid in full',
  refunded: 'Refunded',
};

const BLOCKING: BookingStatus[] = ['confirmed', 'pending', 'completed'];
/** Is this booking actually occupying its unit right now?
 *
 *  A cancelled, declined or no-show booking gave the nights back. So did an
 *  unanswered website request once its hold lapsed — the server says so with
 *  `holding: false`, and every screen here has to ask, because the status alone
 *  still reads 'pending'. Without this the calendar showed a room as taken
 *  while the property's own website was selling that very night. */
const HOLDS = (b: Booking) => BLOCKING.includes(b.status) && b.holding !== false;
const SOLD = HOLDS;

/* confirmBooking answers 409 when the nights were taken while the request sat
   waiting. This used to match the server's WORDING, and the list of words it
   looked for did not include the one the server actually uses ("clash"), so a
   genuine clash would have shown the raw sentence. isDatesTaken reads the HTTP
   status the client now carries, which cannot drift when someone edits copy. */

// ── Reading a booking ────────────────────────────────────────────────────────
// The joined guest record is the one we keep; guest_name and friends are only what
// a website form happened to type, so they are the fallback, never the first read.
const guestName = (b: Booking) => (b.guest?.full_name || b.guest_name || '').trim();
const guestPhone = (b: Booking) => (b.guest?.phone || b.guest_phone || '').trim();
const guestEmail = (b: Booking) => (b.guest?.email || b.guest_email || '').trim();
const sourceLabel = (b: Booking) => (b.source ? SOURCE_LABEL[b.source] : b.channel_id ? SOURCE_LABEL.ota : SOURCE_LABEL.direct);
const nightsLabel = (b: Pick<Booking, 'check_in' | 'check_out'>) => { const n = nights(b); return `${n} night${n === 1 ? '' : 's'}`; };


interface Draft { unit_id: string; guest: string; check_in: string; check_out: string; guests: string; amount: string; status: BookingStatus; paid: PaymentStatus; }
const emptyDraft = (unitId = '', checkIn = iso(new Date())): Draft => ({
  unit_id: unitId, guest: '', check_in: checkIn, check_out: iso(addDays(parseISO(checkIn), 1)),
  guests: '1', amount: '', status: 'confirmed', paid: 'unpaid',
});

export default function HospitalityPage() {
  const tier = useStore(s => s.tier) as Tier;
  const entitled = canAccess(tier, 'hospitality');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [awaiting, setAwaiting] = useState<Booking[]>([]);
  // The Monday of the week on screen, and the month the small calendar shows.
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [calMonth, setCalMonth] = useState(() => monthOf(new Date()));
  const [refreshing, setRefreshing] = useState(false);

  // Panels
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  // Declining asks for a reason first, inline. A browser prompt would lose the
  // booking behind a modal the owner cannot read the dates through.
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [panelNote, setPanelNote] = useState('');
  /** What happened to the guest's email after the last answer. Not an error, so
   *  not the red note: the owner needs to know whether to ring the guest. */
  const [emailNote, setEmailNote] = useState<{ text: string; tone: 'good' | 'warn' } | null>(null);

  // First-run quick setup (no property/unit yet)
  const [setupName, setSetupName] = useState('');
  const [setupUnit, setSetupUnit] = useState('');
  const [setupRate, setSetupRate] = useState('');

  const sym = useMemo(() => symbolForToken(units[0]?.currency) || 'K', [units]);

  const monthStart = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }, []);
  const monthEnd = useMemo(() => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1), [monthStart]);

  // Paging through weeks fires one load per press, and the answers can come
  // back out of order. Only the newest one is drawn, or a fast double press
  // could leave last week's stays on this week's days.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const current = () => seq === loadSeq.current;
    setError('');
    setRefreshing(true);
    try {
      const [props, us] = await Promise.all([listProperties(), listUnits()]);
      // One fetch covering the month's figures, the week on screen and the
      // small month beside it (its dots mark the days guests arrive).
      const mini = monthGrid(calMonth);
      const from = new Date(Math.min(monthStart.getTime(), weekStart.getTime(), mini.start.getTime()));
      const to = new Date(Math.max(monthEnd.getTime(), addDays(weekStart, 7).getTime(), mini.end.getTime()));
      let bk: Booking[] = [];
      let waiting: Booking[] = [];
      if (us.length) {
        [bk, waiting] = await Promise.all([
          listBookings({ from: iso(from), to: iso(to) }),
          // Every request still waiting on an answer, whatever its dates. The window
          // fetch above cannot find one three weeks out, which is how they got missed.
          listBookings({ statuses: ['pending'], order: 'check_in', limit: 100 }),
        ]);
      }
      if (!current()) return;
      setProperties(props);
      setUnits(us);
      setBookings(bk);
      setAwaiting(waiting);
    } catch (e) {
      if (current()) setError(e instanceof Error ? e.message : 'Could not load hospitality data.');
    } finally {
      if (current()) { setLoading(false); setRefreshing(false); }
    }
  }, [monthStart, monthEnd, weekStart, calMonth]);

  useEffect(() => { if (entitled) load(); }, [entitled, load]);

  /** Put a day's week on screen, with its month beside it. */
  const goTo = (d: Date) => { setWeekStart(weekStartOf(d)); setCalMonth(monthOf(d)); };

  // The "New booking" shortcut on the installed app's icon lands on ?new=1:
  // the new-booking form opens once the units are known.
  useEffect(() => {
    if (!entitled || loading || units.length === 0) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('new') !== '1') return;
    url.searchParams.delete('new');
    window.history.replaceState(null, '', url.pathname + url.search);
    openDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitled, loading, units.length]);

  // A booking named in the address (?booking=<id>) opens straight away, with
  // the calendar moved to its dates. The bookings list links here, so any
  // stay, however far away, opens in the same panel with the same buttons as a
  // click on the calendar. Read from window rather than useSearchParams so the
  // page needs no Suspense boundary to build.
  useEffect(() => {
    if (!entitled) return;
    const id = new URLSearchParams(window.location.search).get('booking');
    if (!id) return;
    let cancelled = false;
    getBooking(id)
      .then(b => {
        if (cancelled) return;
        goTo(parseISO(b.check_in));
        openBooking(b);
      })
      .catch(() => { if (!cancelled) setError('That booking could not be opened. It may have been removed.'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitled]);

  // Opening a request from the band has to land the owner on the panel: the panel
  // sits below a full-height calendar, so without this the click looks like nothing
  // happened.
  useEffect(() => {
    if (!selected) return;
    document.getElementById('booking-detail')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selected]);

  // The same for the new-booking form: New booking sits beside the calendar and
  // the form opens under it.
  const drafting = draft !== null;
  useEffect(() => {
    if (!drafting) return;
    document.getElementById('new-booking')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [drafting]);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const unitName = useCallback((id: string) => units.find(u => u.id === id)?.unit_name ?? 'Unit', [units]);
  /** What the calendar draws: only stays that are holding their nights. */
  const stays = useMemo(() => bookings.filter(HOLDS), [bookings]);

  const monthBookings = useMemo(
    () => bookings.filter(b => { const ci = parseISO(b.check_in); return ci >= monthStart && ci < monthEnd; }),
    [bookings, monthStart, monthEnd],
  );
  const occupancy = useMemo(
    () => occupancyRate(units, bookings.filter(SOLD), monthStart, monthEnd),
    [units, bookings, monthStart, monthEnd],
  );
  const revenueThisMonth = useMemo(
    () => monthBookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((s, b) => s + (b.total_amount || 0), 0),
    [monthBookings],
  );
  const checkinsNext7 = useMemo(() => {
    const today = startOfDay(new Date());
    const soon = addDays(today, 7);
    return bookings.filter(b => {
      const ci = parseISO(b.check_in);
      return ci >= today && ci < soon && HOLDS(b);
    }).length;
  }, [bookings]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const openBooking = (b: Booking) => {
    setDraft(null);
    setDeclining(false); setDeclineReason(''); setPanelNote(''); setEmailNote(null);
    setSelected(b);
  };
  const closeBooking = () => {
    setSelected(null); setDeclining(false); setDeclineReason(''); setPanelNote(''); setEmailNote(null);
    // Closed means closed: a reload should not open it again.
    if (new URLSearchParams(window.location.search).has('booking')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const openDraft = (unitId: string, day?: Date) => {
    closeBooking();
    setDraft(emptyDraft(unitId || units[0]?.id || '', day ? iso(day) : iso(new Date())));
  };

  const submitBooking = async () => {
    if (!draft) return;
    setBusy(true); setError('');
    try {
      let guest_id: string | undefined;
      if (draft.guest.trim()) guest_id = (await createGuest({ full_name: draft.guest.trim() })).id;
      await createBooking({
        unit_id: draft.unit_id,
        guest_id,
        check_in: draft.check_in,
        check_out: draft.check_out,
        guests_count: Number(draft.guests) || 1,
        total_amount: Number(draft.amount) || 0,
        status: draft.status,
        payment_status: draft.paid,
      });
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the booking.');
    } finally { setBusy(false); }
  };

  /** Keep the open panel on the booking the server just answered with. The write
   *  routes return the booking alone: the guest is only joined on a list read, so
   *  spreading blindly would blank the name the owner is looking at. */
  const applyUpdate = (updated: Booking) => {
    setSelected(prev => (prev && prev.id === updated.id ? { ...prev, ...updated, guest: updated.guest ?? prev.guest } : prev));
  };

  const doConfirm = async (b: Booking) => {
    setBusy(true); setPanelNote(''); setEmailNote(null); setError('');
    try {
      const { booking, guestEmail } = await confirmBooking(b.id);
      applyUpdate(booking);
      setEmailNote(guestEmailOutcome(guestEmail, guestName(b), 'Confirmed'));
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setPanelNote(isDatesTaken(e)
        ? 'Those nights are no longer free. Another booking took them while this request was waiting, so it cannot be confirmed. Offer the guest different dates or free the nights first.'
        : (msg || 'Could not confirm this booking. Try again in a moment.'));
    } finally { setBusy(false); }
  };

  const doDecline = async (b: Booking) => {
    setBusy(true); setPanelNote(''); setEmailNote(null); setError('');
    try {
      const { booking, guestEmail } = await declineBooking(b.id, declineReason.trim() || undefined);
      applyUpdate(booking);
      setEmailNote(guestEmailOutcome(guestEmail, guestName(b), 'Turned down'));
      setDeclining(false); setDeclineReason('');
      await load();
    } catch (e) {
      setPanelNote(e instanceof Error ? e.message : 'Could not turn down this request.');
    } finally { setBusy(false); }
  };

  const doCancel = async (b: Booking, refund = false) => {
    // A confirmed stay is money in the books and a guest expecting a room.
    // Money already paid is kept as income unless the owner refunds it.
    const paid = b.payment_status === 'paid' ? (b.total_amount || 0)
      : b.payment_status === 'partial' ? Math.min(b.deposit_amount || 0, b.total_amount || 0) : 0;
    const what = paid <= 0
      ? 'The nights are freed and the stay comes out of your books.'
      : refund
        ? `The nights are freed and the ${fmt(paid, false, bookingSymbol(b))} paid comes out of your books as refunded.`
        : `The nights are freed. The ${fmt(paid, false, bookingSymbol(b))} already paid stays in your books as income you kept.`;
    if (!(await confirmSheet({ title: `Cancel ${guestName(b)}'s stay?`, body: what, confirmLabel: 'Cancel the stay', cancelLabel: 'Keep the stay', danger: true }))) return;
    setBusy(true); setPanelNote(''); setError('');
    try {
      applyUpdate(await cancelBooking(b.id, refund));
      await load();
    } catch (e) {
      setPanelNote(e instanceof Error ? e.message : 'Could not cancel this booking.');
    } finally { setBusy(false); }
  };

  /** Say what the guest has paid. Until then the stay is money owed to the
   *  owner, not money in their bank, so this is what moves it into cash. */
  const doPayment = async (b: Booking, status: PaymentStatus, deposit?: number) => {
    if (status === 'refunded' && !(await confirmSheet({ title: `Mark ${guestName(b)}'s stay as refunded?`, body: 'The money from it comes out of your books.', confirmLabel: 'Mark as refunded', danger: true }))) return false;
    setBusy(true); setPanelNote(''); setEmailNote(null); setError('');
    try {
      applyUpdate(await updateBooking(b.id, deposit === undefined
        ? { payment_status: status }
        : { payment_status: status, deposit_amount: deposit }));
      await load();
      return true;
    } catch (e) {
      setPanelNote(e instanceof Error ? e.message : 'Could not save what the guest paid. Try again in a moment.');
      return false;
    } finally { setBusy(false); }
  };

  const runSetup = async () => {
    if (!setupName.trim() || !setupUnit.trim()) return;
    setBusy(true); setError('');
    try {
      const prop = await createProperty({ name: setupName.trim() });
      await createUnit({ property_id: prop.id, unit_name: setupUnit.trim(), base_nightly_rate: Number(setupRate) || 0 });
      setSetupName(''); setSetupUnit(''); setSetupRate('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the property.');
    } finally { setBusy(false); }
  };

  // ── Not entitled → locked-but-visible upsell ────────────────────────────────
  if (!entitled) {
    const need = requiredTier('hospitality');
    return (
      <>
        <div className="grid-main">
          <LockedPreviewCard
            title="Hospitality: property operations"
            headline="Run your short-lets from one calendar."
            detail="Multi-unit availability, direct bookings, guest records, channel sync and per-property profit, all feeding your existing AIBOS books automatically."
            ctaLabel={`Unlock with ${TIERS[need].name}`}
            ctaHref="/pricing"
            badge={TIERS[need].name.toUpperCase()}
            colour="var(--amber)"
          />
        </div>
      </>
    );
  }

  const noUnits = !loading && units.length === 0;

  return (
    <>
      {error && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--red-dim)', border: '1px solid var(--crit)', color: 'var(--crit)', fontSize: 'var(--fs-body)', lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      {/* First-run setup: create the single source of truth for a listing. */}
      {noUnits && (
        <SectionCard title="Add your first property" subtitle="One record per unit becomes the single source of truth every channel pulls from.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12, alignItems: 'end' }}>
            <div><label className="field-label">Property name</label><input className="field" value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="Dunslim Apartments" /></div>
            <div><label className="field-label">First unit</label><input className="field" value={setupUnit} onChange={e => setSetupUnit(e.target.value)} placeholder="Unit A, 2 bedroom" /></div>
            <div><label className="field-label">Nightly rate ({sym})</label><input className="field" type="number" min="0" value={setupRate} onChange={e => setSetupRate(e.target.value)} placeholder="850" /></div>
            <button className="pill pill-primary" style={{ opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={runSetup}>{busy ? 'Creating…' : 'Create'}</button>
          </div>
        </SectionCard>
      )}

      {!noUnits && (
        <>
          {/* Needs your answer: the requests that expire quietly if nobody looks.
              Top of the page on purpose: the calendar only shows one week. Each
              one is drawn the calendar's way for a request: a dashed date. */}
          {awaiting.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <SectionCard
                title="Needs your answer"
                subtitle={`${awaiting.length} request${awaiting.length === 1 ? '' : 's'} waiting on you. Confirming one books the stay and records the money in your books.`}
                action={<Chip tone="wait">{awaiting.length} waiting</Chip>}
              >
                <div className="rs-list">
                  {awaiting.map(b => (
                    <button key={b.id} type="button" className="rs-req" onClick={() => openBooking(b)}>
                      <DayBadge date={b.check_in} tone="wait" />
                      <span className="rs-req-main">
                        <span className="rs-row-title">{guestName(b) || 'No name given'}</span>
                        <span className="rs-row-line">
                          {shortDate(b.check_in)} to {shortDate(b.check_out)} · {nightsLabel(b)} · {unitName(b.unit_id)}
                        </span>
                        {/* Still in the queue, no longer standing in anyone's way.
                            Saying nothing would have the owner believe the room is
                            being kept when the website can already sell it. */}
                        {b.holding === false && (
                          <span className="rs-req-flag">Waited too long, so the dates are open again</span>
                        )}
                      </span>
                      <span className="rs-req-side">
                        <span className="rs-req-amt">{fmt(b.total_amount || 0, false, bookingSymbol(b))}</span>
                        <span className="rs-btn is-navy is-sm">Answer</span>
                      </span>
                    </button>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {/* KPI row */}
          <div className="grid-kpi" style={{ marginBottom: 18 }}>
            <KPICard label="Occupancy" sublabel="this month" value={`${Math.round(occupancy * 100)}%`} sub={`${units.length} unit${units.length === 1 ? '' : 's'}`} sparkColor="#34d399" />
            <KPICard label="Revenue booked" sublabel="this month" value={fmt(revenueThisMonth, false, sym)} sub="posts to your books" sparkColor="#60a5fa" />
            <KPICard label="Check-ins" sublabel="next 7 days" value={String(checkinsNext7)} sub="arrivals to prep" sparkColor="#fbbf24" />
            <KPICard label="Properties" sublabel="portfolio" value={String(properties.length)} sub={`${units.length} unit${units.length === 1 ? '' : 's'} total`} sparkColor="#a78bfa" />
          </div>

          {/* Hero: the week, one lane per unit (the owner's reference, 7 Oct 2026) */}
          <SectionCard explainId="hospitality.calendar">
            <WeekCalendar
              units={units}
              stays={stays}
              weekStart={weekStart}
              onWeekStart={setWeekStart}
              month={calMonth}
              onMonth={setCalMonth}
              selectedId={selected?.id}
              loading={loading || refreshing}
              rate={u => `${fmt(u.base_nightly_rate, false, symbolForToken(u.currency) || sym)} a night`}
              onOpen={openBooking}
              onJump={b => { goTo(parseISO(b.check_in)); openBooking(b); }}
              onNew={(unitId, day) => openDraft(unitId, day)}
            />
          </SectionCard>

          {/* New-booking form */}
          {draft && (
            <div id="new-booking">
            <SectionCard title="New booking" subtitle="A confirmed booking with an amount records a Sale in your books. It counts as money owed to you until the guest pays.">
              {/* The booking as it will sit on the calendar, drawn as it is typed. */}
              <div className={`wk-block rs-preview${draft.status === 'pending' ? ' is-wait' : ''}`} aria-hidden="true">
                <span className="wk-block-name">{draft.guest.trim() || 'New guest'}</span>
                <span className="wk-block-sub">
                  {unitName(draft.unit_id)} · {shortDate(draft.check_in)} to {shortDate(draft.check_out)}
                </span>
                <span className="wk-block-meta">{nightsLabel(draft)}</span>
              </div>
              <div className="rs-form">
                <div>
                  <label className="field-label">Unit</label>
                  <select className="field" value={draft.unit_id} onChange={e => setDraft({ ...draft, unit_id: e.target.value })}>
                    {units.map(u => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
                  </select>
                </div>
                <div><label className="field-label">Guest name</label><input className="field" value={draft.guest} onChange={e => setDraft({ ...draft, guest: e.target.value })} placeholder="Optional. Saves the guest" /></div>
                <div><label className="field-label">Check-in</label><input className="field" type="date" value={draft.check_in} onChange={e => setDraft({ ...draft, check_in: e.target.value, check_out: e.target.value >= draft.check_out ? iso(addDays(parseISO(e.target.value), 1)) : draft.check_out })} /></div>
                <div><label className="field-label">Check-out</label><input className="field" type="date" value={draft.check_out} min={draft.check_in} onChange={e => setDraft({ ...draft, check_out: e.target.value })} /></div>
                <div><label className="field-label">Guests</label><input className="field" type="number" min="1" value={draft.guests} onChange={e => setDraft({ ...draft, guests: e.target.value })} /></div>
                <div><label className="field-label">Total ({sym})</label><input className="field" type="number" min="0" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="Records revenue" /></div>
              </div>
              <div className="rs-form" style={{ marginTop: 18 }}>
                <div>
                  <span className="field-label">Status</span>
                  <Segmented<BookingStatus>
                    label="Status"
                    options={(['confirmed', 'pending'] as BookingStatus[]).map(s => ({ value: s, label: statusLabel(s) }))}
                    value={draft.status}
                    onChange={s => setDraft({ ...draft, status: s })}
                  />
                </div>
                <div>
                  <span className="field-label">Paid?</span>
                  <Segmented<PaymentStatus>
                    label="Paid?"
                    options={(['unpaid', 'paid'] as PaymentStatus[]).map(s => ({ value: s, label: PAYMENT_LABEL[s] }))}
                    value={draft.paid}
                    onChange={s => setDraft({ ...draft, paid: s })}
                  />
                </div>
              </div>
              <div className="rs-btns" style={{ marginTop: 20 }}>
                <button type="button" className="rs-btn is-navy" disabled={busy || !draft.unit_id} onClick={submitBooking}>
                  <CalendarPlus aria-hidden="true" /> {busy ? 'Saving…' : 'Save booking'}
                </button>
                <button type="button" className="rs-btn is-quiet" onClick={() => setDraft(null)}>Discard</button>
              </div>
            </SectionCard>
            </div>
          )}

          {/* Booking detail: the whole booking plus the decision it is waiting for. */}
          {selected && (
            <div id="booking-detail">
              <BookingPanel
                key={selected.id}
                booking={selected}
                unitName={unitName(selected.unit_id)}
                busy={busy}
                note={panelNote}
                emailNote={emailNote}
                declining={declining}
                declineReason={declineReason}
                onDeclineReason={setDeclineReason}
                onStartDecline={() => { setPanelNote(''); setDeclining(true); }}
                onStopDecline={() => { setDeclining(false); setDeclineReason(''); }}
                onConfirm={() => doConfirm(selected)}
                onDecline={() => doDecline(selected)}
                onCancel={(refund) => doCancel(selected, refund)}
                onPayment={(status, deposit) => doPayment(selected, status, deposit)}
                onSaved={(b) => { applyUpdate(b); void load(); }}
                onClose={closeBooking}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}


// ── The booking panel ────────────────────────────────────────────────────────
// Built from the calendar's pieces (components/hospitality/kit.tsx): the stay
// as a large block at the top, its nights drawn as on the calendar, facts
// under spaced-capital labels, and parts set off by hairlines. Status is told
// by fill, as on the calendar, never by a thin coloured edge.

interface PanelProps {
  booking: Booking;
  unitName: string;
  busy: boolean;
  note: string;
  emailNote: { text: string; tone: 'good' | 'warn' } | null;
  declining: boolean;
  declineReason: string;
  onDeclineReason: (v: string) => void;
  onStartDecline: () => void;
  onStopDecline: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  onCancel: (refund?: boolean) => void;
  onPayment: (status: PaymentStatus, deposit?: number) => Promise<boolean>;
  onSaved: (b: Booking) => void;
  onClose: () => void;
}

const PAYMENT_CHOICES: { value: PaymentStatus; label: string }[] = [
  { value: 'unpaid', label: 'Not paid yet' },
  { value: 'partial', label: 'Deposit paid' },
  { value: 'paid', label: 'Paid in full' },
  { value: 'refunded', label: 'Refunded' },
];

function BookingPanel({
  booking: b, unitName, busy, note, emailNote, declining, declineReason,
  onDeclineReason, onStartDecline, onStopDecline, onConfirm, onDecline, onCancel, onPayment, onSaved, onClose,
}: PanelProps) {
  const g = b.guest;
  const name = guestName(b);
  const phone = guestPhone(b);
  const email = guestEmail(b);
  const symbol = bookingSymbol(b);
  const tone = toneOf(b.status);
  const people = `${b.guests_count} guest${b.guests_count === 1 ? '' : 's'}`;

  // Only a request that is still waiting can be answered. Anything cancelled,
  // declined or already finished is closed: offering Confirm on it would post
  // revenue for a stay nobody is coming to.
  const waiting = b.status === 'pending';
  const cancellable = b.status === 'confirmed';
  const quoted = b.quoted_total ?? null;
  const showQuoted = quoted !== null && quoted !== (b.total_amount || 0);
  const myNote = (g?.notes ?? '').trim();

  // A stay that is income: what the guest has paid decides whether that income
  // is money in the bank or money still owed.
  const total = b.total_amount || 0;
  const earns = (b.status === 'confirmed' || b.status === 'completed') && total > 0;
  const payment: PaymentStatus = b.payment_status || 'unpaid';
  const [takingDeposit, setTakingDeposit] = useState(false);
  const [deposit, setDeposit] = useState(b.deposit_amount ? String(b.deposit_amount) : '');
  const depositValue = Number(deposit);
  const depositOk = deposit.trim() !== '' && depositValue > 0 && depositValue < total;
  const paidSoFar = payment === 'paid' ? total : payment === 'partial' ? Math.min(b.deposit_amount || 0, total) : 0;
  const paidShare = payment === 'refunded' || total <= 0 ? 0 : Math.min(100, Math.round((paidSoFar / total) * 100));
  const moneySummary = payment === 'refunded'
    ? 'Refunded. This stay no longer counts as income.'
    : payment === 'paid'
      ? `Paid in full. All ${fmt(total, false, symbol)} is in your cash.`
      : payment === 'partial'
        ? `${fmt(paidSoFar, false, symbol)} paid. ${fmt(total - paidSoFar, false, symbol)} is still owed to you.`
        : `Not paid yet. ${fmt(total, false, symbol)} is owed to you and is not in your cash until you mark it paid.`;
  const choose = async (status: PaymentStatus) => {
    if (status === 'partial') { setTakingDeposit(true); return; }
    setTakingDeposit(false);
    await onPayment(status);
  };
  const saveDeposit = async () => {
    if (!depositOk) return;
    if (await onPayment('partial', Math.round(depositValue * 100) / 100)) setTakingDeposit(false);
  };

  // Everything that has happened to the booking, oldest first: the decision
  // and the emails the guest was sent used to sit in two separate lists.
  const history = ([
    b.created_at && { at: b.created_at, what: b.source === 'website' ? 'Request came in' : 'Booking made', dot: '' },
    b.guest_emails?.received && { at: b.guest_emails.received, what: 'Email sent: request received', dot: '' },
    b.confirmed_at && { at: b.confirmed_at, what: 'Confirmed', dot: '' },
    b.guest_emails?.confirmed && { at: b.guest_emails.confirmed, what: 'Email sent: booking confirmed', dot: '' },
    b.declined_at && { at: b.declined_at, what: 'Turned down', dot: 'is-off' },
    b.guest_emails?.declined && { at: b.guest_emails.declined, what: 'Email sent: request turned down', dot: 'is-off' },
    b.cancelled_at && { at: b.cancelled_at, what: 'Cancelled', dot: 'is-off' },
  ].filter(Boolean) as { at: string; what: string; dot: string }[])
    .map((h, i) => ({ ...h, i, t: new Date(h.at).getTime() }))
    .sort((x, y) => (Number.isNaN(x.t) || Number.isNaN(y.t) ? x.i - y.i : x.t - y.t || x.i - y.i));

  const arrive = parseISO(b.check_in);
  const leave = parseISO(b.check_out);
  const weekday = (d: Date) => d.toLocaleDateString([], { weekday: 'long' });
  const monthYear = (d: Date) => d.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <SectionCard>
      {/* WHO, WHEN AND WHERE: the stay as a block, as on the calendar */}
      <header className={`rs-hero is-${tone}`}>
        <div className="rs-hero-top">
          <div className="rs-hero-chips">
            <Chip tone={tone}>{statusLabel(b.status)}</Chip>
            {g?.vip_flag && <Chip>VIP</Chip>}
            {g?.is_repeat_guest && (
              <Chip>{g.stay_count && g.stay_count > 1 ? `Repeat guest · ${g.stay_count} stays` : 'Repeat guest'}</Chip>
            )}
          </div>
          <button type="button" aria-label="Close this booking" onClick={onClose} className="rs-hero-close">
            <X aria-hidden="true" />
          </button>
        </div>
        <h2 className="rs-hero-name">{name || 'No name on this booking'}</h2>
        {(b.organisation || '').trim() && <div className="rs-hero-org">{b.organisation}</div>}
        <div className="rs-hero-meta">
          <span><CalendarDays aria-hidden="true" />{shortDate(b.check_in)} to {shortDate(b.check_out)} · {nightsLabel(b)}</span>
          <span><MapPin aria-hidden="true" />{unitName} · {sourceLabel(b)}</span>
          <span><UserRound aria-hidden="true" />{people}</span>
        </div>
        <div className="rs-hero-links">
          {phone && (
            <a className="rs-hero-link" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
              <Phone aria-hidden="true" /> Call {phone}
            </a>
          )}
          {email && (
            <a className="rs-hero-link" href={`mailto:${email}`}>
              <Mail aria-hidden="true" /> {email}
            </a>
          )}
          {!phone && !email && <span className="rs-hero-quiet">No phone number or email on this booking.</span>}
        </div>
      </header>

      {/* WHEN: arrival, the nights between, departure */}
      <Section title="When">
        <div className={`rs-stay is-${tone}`}>
          <div className="rs-date" role="group" aria-label={`Arrives ${longDate(b.check_in)}`}>
            <span className="rs-date-num" aria-hidden="true">{arrive.getDate()}</span>
            <div aria-hidden="true">
              <div className="rs-date-label">Arrives</div>
              <div className="rs-date-day">{weekday(arrive)}</div>
              <div className="rs-date-month">
                {monthYear(arrive)}{b.arrival_time ? ` · from ${String(b.arrival_time).slice(0, 5)}` : ''}
              </div>
            </div>
          </div>
          <div className="rs-stay-bar" aria-hidden="true">{nightsLabel(b)}</div>
          <div className="rs-date is-leave" role="group" aria-label={`Leaves ${longDate(b.check_out)}`}>
            <span className="rs-date-num" aria-hidden="true">{leave.getDate()}</span>
            <div aria-hidden="true">
              <div className="rs-date-label">Leaves</div>
              <div className="rs-date-day">{weekday(leave)}</div>
              <div className="rs-date-month">{monthYear(leave)}</div>
            </div>
          </div>
        </div>
      </Section>

      {/* WHAT */}
      <Section title="What they booked">
        <Facts>
          <Fact label="Unit" value={unitName} />
          <Fact label="People staying" value={people} />
          <Fact label="Amount" value={fmt(b.total_amount || 0, false, symbol)} />
          {showQuoted && <Fact label="You quoted" value={fmt(quoted || 0, false, symbol)} hint="Different from the amount above" />}
          {!earns && <Fact label="Payment" value={PAYMENT_LABEL[b.payment_status] ?? sentence(b.payment_status)} hint={sentence(b.payment_method) || undefined} />}
          {b.reference && <Fact label="Their reference" value={b.reference} hint="The code the guest was given" />}
          <Fact label="Came from" value={sourceLabel(b)} />
          {b.purpose && <Fact label="Reason for the stay" value={sentence(b.purpose)} />}
          <Fact
            label="In your books"
            value={b.linked_event_id ? <span className="rs-yes">Yes, posted</span> : waiting ? 'Not until you confirm' : 'Not posted'}
          />
        </Facts>
      </Section>

      {/* WHAT THEY HAVE PAID */}
      {earns && (
        <Section title="Money from this stay">
          <div className="rs-money-head">
            <span className="rs-money-big">{payment === 'refunded' ? 'Refunded' : fmt(paidSoFar, false, symbol)}</span>
            <span className="rs-money-of">{payment === 'refunded' ? `of ${fmt(total, false, symbol)}` : `paid of ${fmt(total, false, symbol)}`}</span>
          </div>
          <div className="rs-progress" aria-hidden="true"><span style={{ width: `${paidShare}%` }} /></div>
          <p className="rs-text is-strong">{moneySummary}</p>
          {b.payment_method && (
            <p className="rs-text is-quiet">The guest said they would pay by {sentence(b.payment_method).toLowerCase()}.</p>
          )}
          <div style={{ marginTop: 16 }}>
            <Segmented
              label="What the guest has paid"
              options={PAYMENT_CHOICES}
              value={takingDeposit ? 'partial' : payment}
              onChange={choose}
              disabled={busy}
            />
          </div>
          {takingDeposit && (
            <div className="rs-form" style={{ marginTop: 16, maxWidth: 640 }}>
              <div>
                <label className="field-label" htmlFor="deposit-amount">Deposit received ({symbol})</label>
                <input
                  id="deposit-amount"
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={deposit}
                  onChange={e => setDeposit(e.target.value)}
                  placeholder={`Less than ${fmt(total, false, symbol)}`}
                />
              </div>
              <div className="rs-btns">
                <button type="button" className="rs-btn is-navy is-sm" disabled={busy || !depositOk} onClick={saveDeposit}>
                  {busy ? 'Saving…' : 'Save deposit'}
                </button>
                <button type="button" className="rs-btn is-quiet is-sm" disabled={busy} onClick={() => setTakingDeposit(false)}>Never mind</button>
              </div>
              {deposit.trim() !== '' && !depositOk && (
                <p className="rs-text" style={{ gridColumn: '1 / -1', color: 'var(--warn)' }}>
                  A deposit is more than nothing and less than the whole {fmt(total, false, symbol)}. If they paid it all, choose Paid in full.
                </p>
              )}
            </div>
          )}
          <Instalments booking={b} symbol={symbol} owed={total - paidSoFar} onSaved={onSaved} />
        </Section>
      )}

      {/* KEPT WHEN CALLED OFF (upgrade 5) */}
      {(b.status === 'cancelled' || b.status === 'no_show') && (b.kept_amount || 0) > 0 && b.payment_status !== 'refunded' && (
        <Section title="Money from this stay">
          <div className="rs-money-head">
            <span className="rs-money-big">{fmt(b.kept_amount || 0, false, symbol)}</span>
            <span className="rs-money-of">kept</span>
          </div>
          <p className="rs-text" style={{ marginTop: 12 }}>
            You kept {fmt(b.kept_amount || 0, false, symbol)} when this stay was called off. It stays in your books as income.
          </p>
        </Section>
      )}

      {/* A LINK THE GUEST PAYS FROM (upgrade 3) */}
      {earns && payment !== 'paid' && payment !== 'refunded' && (
        <PayLinkBlock booking={b} owed={total - paidSoFar} symbol={symbol} unitName={unitName} phone={phone} name={name} />
      )}

      {/* THEIR WORDS */}
      {(b.guest_notes || '').trim() && (
        <Section title="What the guest wrote">
          <blockquote className="rs-quote">{b.guest_notes}</blockquote>
        </Section>
      )}

      {myNote && (
        <Section title="Your note about this guest">
          <p className="rs-quote is-plain">{myNote}</p>
        </Section>
      )}

      {/* WHAT HAS HAPPENED: the decision and the emails, in order. "Did they
          hear from us?" never needs a phone call. */}
      {history.length > 0 && (
        <Section title="What has happened">
          <ol className="rs-timeline">
            {history.map(h => (
              <li key={`${h.what}-${h.i}`}>
                <span className={`rs-dot ${h.dot}`} aria-hidden="true" />
                <div>
                  <div className="rs-tl-what">{h.what}</div>
                  <div className="rs-tl-when">{stamp(h.at)}</div>
                </div>
              </li>
            ))}
          </ol>
          {(b.decline_reason || '').trim() && (
            <p className="rs-text" style={{ marginTop: 16 }}>Reason given: {b.decline_reason}</p>
          )}
        </Section>
      )}

      {emailNote && <Note tone={emailNote.tone}>{emailNote.text}</Note>}

      {/* Something went wrong on the last action, said plainly. */}
      {note && <Note tone="bad">{note}</Note>}

      {/* THE ACTIONS */}
      <div className="rs-actions">
        {waiting && !declining && (
          <>
            <p className="rs-text">
              Confirming holds the dates for this guest and records the money in your books. Turning it down frees the nights straight away.
            </p>
            <div className="rs-btns">
              <button type="button" className="rs-btn is-navy" disabled={busy} onClick={onConfirm}>
                <Check aria-hidden="true" /> {busy ? 'Confirming…' : 'Confirm and put it in the books'}
              </button>
              <button type="button" className="rs-btn is-dark" disabled={busy} onClick={onStartDecline}>
                <X aria-hidden="true" /> Turn it down
              </button>
            </div>
          </>
        )}

        {waiting && declining && (
          <div style={{ maxWidth: 560 }}>
            <label className="field-label" htmlFor="decline-reason">Why are you turning it down?</label>
            <input
              id="decline-reason"
              className="field"
              value={declineReason}
              onChange={e => onDeclineReason(e.target.value)}
              placeholder="Optional. The guest never sees this"
            />
            <div className="rs-btns" style={{ marginTop: 14 }}>
              <button type="button" className="rs-btn is-danger" disabled={busy} onClick={onDecline}>
                {busy ? 'Turning it down…' : 'Turn down this request'}
              </button>
              <button type="button" className="rs-btn is-quiet" disabled={busy} onClick={onStopDecline}>Keep it waiting</button>
            </div>
          </div>
        )}

        {cancellable && (
          <>
            <p className="rs-text">
              This stay is booked. Cancelling frees the nights for somebody else.
              {paidSoFar > 0 && ` The guest has paid ${fmt(paidSoFar, false, symbol)}: keep it (a deposit they lose) or refund it.`}
            </p>
            <div className="rs-btns">
              <button type="button" className="rs-btn is-danger" disabled={busy} onClick={() => onCancel(false)}>
                {busy ? 'Cancelling…' : paidSoFar > 0 ? `Cancel and keep the ${fmt(paidSoFar, false, symbol)}` : 'Cancel this booking'}
              </button>
              {paidSoFar > 0 && (
                <button type="button" className="rs-btn is-dark" disabled={busy} onClick={() => onCancel(true)}>
                  Cancel and refund it
                </button>
              )}
            </div>
          </>
        )}

        {!waiting && !cancellable && (
          <p className="rs-text is-quiet" style={{ margin: 0 }}>This booking is closed. Nothing left to answer.</p>
        )}
      </div>
    </SectionCard>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<StayPaymentMethod, string> = {
  cash: 'Cash', mobile_money: 'Mobile money', card: 'Card', bank: 'Bank',
};

/**
 * Every payment on the stay, each with its own day and how it was paid, and a
 * way to add the next one (upgrades 4 and 9). A stay used to hold one deposit
 * and then "the rest", all under the one method the guest mentioned when they
 * booked, so the cash drawer and the mobile money wallet could not be told
 * apart and nothing said what came in when.
 */
function Instalments({ booking: b, symbol, owed, onSaved }: {
  booking: Booking; symbol: string; owed: number; onSaved: (b: Booking) => void;
}) {
  const today = iso(new Date());
  const [list, setList] = useState<StayPayment[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(today);
  const [method, setMethod] = useState<StayPaymentMethod>(
    (['cash', 'mobile_money', 'card', 'bank'] as const).includes(b.payment_method as StayPaymentMethod)
      ? (b.payment_method as StayPaymentMethod) : 'cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listStayPayments(b.id).then((p) => { if (alive) setList(p); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [b.id, b.payment_status, b.deposit_amount]);

  const value = Number(amount);
  const ok = amount.trim() !== '' && value > 0 && value <= owed + 0.005 && !!day && day <= today;

  const add = async () => {
    if (!ok) return;
    setBusy(true); setError('');
    try {
      const out = await addStayPayment(b.id, { amount: Math.round(value * 100) / 100, paid_on: day, method });
      setList(out.payments); setAdding(false); setAmount(''); setDay(today);
      onSaved(out.booking);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the payment.');
    } finally { setBusy(false); }
  };

  const remove = async (p: StayPayment) => {
    if (!(await confirmSheet({ title: `Take the ${fmt(p.amount, false, symbol)} payment of ${shortDate(p.date)} off this stay?`, body: 'It comes out of your books.', confirmLabel: 'Take it off', danger: true }))) return;
    setBusy(true); setError('');
    try {
      const out = await removeStayPayment(b.id, p.id);
      setList(out.payments);
      onSaved(out.booking);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the payment.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 20 }}>
      {list && list.length > 0 && (
        <div className="rs-list" style={{ marginBottom: 12 }}>
          <div className="rs-fact-label">Payments received</div>
          {list.map((p) => (
            <div key={p.id} className="rs-row">
              <DayBadge date={p.date} small />
              <div className="rs-row-main">
                <span className="rs-row-title">{fmt(p.amount, false, symbol)}</span>
                <span className="rs-row-line">{shortDate(p.date)} · {METHOD_LABEL[p.method] ?? p.method}</span>
              </div>
              <button type="button" className="rs-btn is-quiet is-sm" onClick={() => remove(p)} disabled={busy}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {owed > 0.005 && !adding && (
        <button type="button" className="rs-btn is-quiet is-sm" disabled={busy} onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" /> Add a payment
        </button>
      )}
      {adding && (
        <div className="rs-form" style={{ maxWidth: 720 }}>
          <div>
            <label className="field-label" htmlFor="inst-amount">Amount ({symbol})</label>
            <input id="inst-amount" className="field" type="number" min="0" step="0.01" inputMode="decimal"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Up to ${fmt(owed, false, symbol)}`} />
          </div>
          <div>
            <label className="field-label" htmlFor="inst-day">Paid on</label>
            <input id="inst-day" className="field" type="date" max={today} value={day} onChange={e => setDay(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="inst-method">How</label>
            <select id="inst-method" className="field" value={method} onChange={e => setMethod(e.target.value as StayPaymentMethod)}>
              {(Object.keys(METHOD_LABEL) as StayPaymentMethod[]).map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </div>
          <div className="rs-btns">
            <button type="button" className="rs-btn is-navy is-sm" disabled={busy || !ok} onClick={add}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="rs-btn is-quiet is-sm" disabled={busy} onClick={() => { setAdding(false); setError(''); }}>Cancel</button>
          </div>
        </div>
      )}
      {amount.trim() !== '' && value > owed + 0.005 && (
        <p className="rs-text" style={{ marginTop: 10, color: 'var(--warn)' }}>
          That is more than the {fmt(owed, false, symbol)} still owed.
        </p>
      )}
      {error && <Note tone="bad">{error}</Note>}
    </div>
  );
}

/**
 * A payment link for the guest: everything still owed, or a deposit. The guest
 * pays by mobile money from the link and the booking marks itself paid, with
 * the money in the books once. The owner used to chase the deposit on
 * WhatsApp and press "Deposit paid" by hand when an SMS came in.
 */
function PayLinkBlock({ booking: b, owed, symbol, unitName, phone, name }: {
  booking: Booking; owed: number; symbol: string; unitName: string; phone: string; name: string;
}) {
  const [mode, setMode] = useState<'all' | 'deposit'>('all');
  const [deposit, setDeposit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState<{ url: string; requested: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const depositValue = Number(deposit);
  const depositOk = deposit.trim() !== '' && depositValue > 0 && depositValue < owed;

  const make = async () => {
    setBusy(true); setError(''); setCopied(false);
    try {
      const out = await createStayPayLink(b.id, mode === 'deposit' ? Math.round(depositValue * 100) / 100 : null);
      setLink({ url: out.url, requested: out.requested });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make the link.');
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setCopied(true); } catch { setCopied(false); }
  };

  // A Zambian number as WhatsApp wants it: 0977… becomes 260977….
  const waNumber = (() => {
    const d = phone.replace(/\D/g, '');
    if (!d) return '';
    return d.startsWith('0') ? `260${d.slice(1)}` : d;
  })();
  const first = (name || '').trim().split(/\s+/)[0];
  const message = link
    ? `Hello${first ? ` ${first}` : ''}, here is the link to pay ${fmt(link.requested, false, symbol)} for your stay` +
      `${unitName ? ` at ${unitName}` : ''}, ${shortDate(b.check_in)} to ${shortDate(b.check_out)}. ` +
      `You pay by MTN or Airtel mobile money and it confirms by itself: ${link.url}`
    : '';

  return (
    <Section title="Payment link for the guest">
      <p className="rs-text">
        Send the guest a link. They pay by mobile money from their phone and this booking marks itself paid.
      </p>
      <div style={{ marginTop: 16 }}>
        <Segmented
          label="How much the link asks for"
          options={[
            { value: 'all', label: `Everything owed (${fmt(owed, false, symbol)})` },
            { value: 'deposit', label: 'A deposit' },
          ]}
          value={mode}
          onChange={m => { setMode(m); setLink(null); }}
        />
      </div>
      {mode === 'deposit' && (
        <div style={{ maxWidth: 320, marginTop: 16 }}>
          <label className="field-label" htmlFor="link-deposit">Deposit to ask for ({symbol})</label>
          <input id="link-deposit" className="field" type="number" min="0" step="0.01" inputMode="decimal"
            value={deposit} onChange={e => { setDeposit(e.target.value); setLink(null); }}
            placeholder={`Less than ${fmt(owed, false, symbol)}`} />
        </div>
      )}
      <div className="rs-btns" style={{ marginTop: 16 }}>
        <button type="button" className="rs-btn is-navy" disabled={busy || (mode === 'deposit' && !depositOk)} onClick={make}>
          <Link2 aria-hidden="true" /> {busy ? 'Making the link…' : link ? 'Make it again' : 'Make the link'}
        </button>
      </div>
      {error && <Note tone="bad">{error}</Note>}
      {link && (
        <div className="rs-quote is-plain" style={{ marginTop: 16, whiteSpace: 'normal' }}>
          <span className="rs-quote-label">Asks for {fmt(link.requested, false, symbol)}</span>
          <div style={{ wordBreak: 'break-all' }}>{link.url}</div>
          <div className="rs-btns" style={{ marginTop: 14 }}>
            <button type="button" className="rs-btn is-dark is-sm" onClick={copy}>
              <Copy aria-hidden="true" /> {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`}
              target="_blank" rel="noopener noreferrer"
              className="rs-btn is-navy is-sm"
            >
              <MessageCircle aria-hidden="true" /> {waNumber ? 'Send on WhatsApp' : 'Share on WhatsApp'}
            </a>
          </div>
        </div>
      )}
    </Section>
  );
}
