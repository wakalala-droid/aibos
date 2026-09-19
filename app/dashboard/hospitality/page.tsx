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
 * 14-day calendar window, which is exactly how requests went unanswered.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SectionCard from '@/components/ui/SectionCard';
import KPICard from '@/components/ui/KPICard';
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
const WINDOW = 14; // days shown across the calendar

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

// Status → colour and words (visual_language_system: colour carries meaning).
// Keyed on the plain string because the API also answers 'declined' for a request
// that was never agreed to, which the shared BookingStatus union does not carry yet.
const STATUS_COLOUR: Record<string, string> = {
  confirmed: 'var(--good)',
  pending:   'var(--warn)',
  completed: 'var(--text-3)',
  cancelled: 'var(--text-4)',
  declined:  'var(--text-4)',
  no_show:   'var(--crit)',
};
const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  pending:   'Waiting for your answer',
  completed: 'Stay finished',
  cancelled: 'Cancelled',
  declined:  'Turned down',
  no_show:   'Never arrived',
};
const statusColour = (s: string) => STATUS_COLOUR[s] ?? 'var(--text-3)';
const statusLabel = (s: string) => STATUS_LABEL[s] ?? sentence(s);

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid:   'Not paid yet',
  partial:  'Part paid',
  paid:     'Paid in full',
  refunded: 'Refunded',
};
const PAYMENT_COLOUR: Record<PaymentStatus, string> = {
  unpaid:   'var(--warn)',
  partial:  'var(--warn)',
  paid:     'var(--good)',
  refunded: 'var(--text-3)',
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
const nightsLabel = (b: Booking) => { const n = nights(b); return `${n} night${n === 1 ? '' : 's'}`; };

const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', minHeight: 44, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontSize: 18, lineHeight: 1.6, outline: 'none',
};
const lbl: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};
const primaryBtn: React.CSSProperties = {
  padding: '10px 18px', minHeight: 44, borderRadius: 8, border: 'none', background: 'var(--cyan)',
  color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1.6, cursor: 'pointer',
};
const quietBtn: React.CSSProperties = {
  ...primaryBtn, background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border-md)',
};

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
  const [gridStart, setGridStart] = useState(() => startOfDay(new Date()));

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

  const load = useCallback(async (gStart: Date) => {
    setError('');
    try {
      const [props, us] = await Promise.all([listProperties(), listUnits()]);
      setProperties(props);
      setUnits(us);
      // One fetch covering both the month KPIs and the visible grid window.
      const from = new Date(Math.min(monthStart.getTime(), gStart.getTime()));
      const to = new Date(Math.max(monthEnd.getTime(), addDays(gStart, WINDOW).getTime()));
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
      setBookings(bk);
      setAwaiting(waiting);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load hospitality data.');
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => { if (entitled) load(gridStart); }, [entitled, gridStart, load]);

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
        setGridStart(addDays(startOfDay(parseISO(b.check_in)), -1));
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

  // ── Derived metrics ────────────────────────────────────────────────────────
  const days = useMemo(() => Array.from({ length: WINDOW }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const unitName = useCallback((id: string) => units.find(u => u.id === id)?.unit_name ?? 'Unit', [units]);

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

  /** The blocking booking occupying a given unit on a given day, if any. */
  const occupancyOn = useCallback((unitId: string, day: Date): Booking | undefined => {
    const t = day.getTime();
    return bookings.find(b =>
      b.unit_id === unitId && HOLDS(b) &&
      parseISO(b.check_in).getTime() <= t && parseISO(b.check_out).getTime() > t,
    );
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
      await load(gridStart);
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
      await load(gridStart);
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
      await load(gridStart);
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
        ? `The nights are freed, and the ${fmt(paid, false, bookingSymbol(b))} paid comes out of your books as refunded.`
        : `The nights are freed. The ${fmt(paid, false, bookingSymbol(b))} already paid stays in your books as income you kept.`;
    if (!window.confirm(`Cancel ${guestName(b)}'s stay? ${what}`)) return;
    setBusy(true); setPanelNote(''); setError('');
    try {
      applyUpdate(await cancelBooking(b.id, refund));
      await load(gridStart);
    } catch (e) {
      setPanelNote(e instanceof Error ? e.message : 'Could not cancel this booking.');
    } finally { setBusy(false); }
  };

  /** Say what the guest has paid. Until then the stay is money owed to the
   *  owner, not money in their bank, so this is what moves it into cash. */
  const doPayment = async (b: Booking, status: PaymentStatus, deposit?: number) => {
    if (status === 'refunded' && !window.confirm(`Mark ${guestName(b)}'s stay as refunded? The money from it comes out of your books.`)) return false;
    setBusy(true); setPanelNote(''); setEmailNote(null); setError('');
    try {
      applyUpdate(await updateBooking(b.id, deposit === undefined
        ? { payment_status: status }
        : { payment_status: status, deposit_amount: deposit }));
      await load(gridStart);
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
      await load(gridStart);
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
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--crit)', color: 'var(--crit)', fontSize: 18, lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      {/* First-run setup: create the single source of truth for a listing. */}
      {noUnits && (
        <SectionCard title="Add your first property" subtitle="One record per unit becomes the single source of truth every channel pulls from.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div><label style={lbl}>Property name</label><input style={input} value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="Dunslim Apartments" /></div>
            <div><label style={lbl}>First unit</label><input style={input} value={setupUnit} onChange={e => setSetupUnit(e.target.value)} placeholder="Unit A, 2 bedroom" /></div>
            <div><label style={lbl}>Nightly rate ({sym})</label><input style={input} type="number" min="0" value={setupRate} onChange={e => setSetupRate(e.target.value)} placeholder="850" /></div>
            <button style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={runSetup}>{busy ? 'Creating…' : 'Create'}</button>
          </div>
        </SectionCard>
      )}

      {!noUnits && (
        <>
          {/* Needs your answer: the requests that expire quietly if nobody looks.
              Top of the page on purpose: the calendar only shows 14 days. */}
          {awaiting.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <SectionCard
                title="Needs your answer"
                subtitle={`${awaiting.length} request${awaiting.length === 1 ? '' : 's'} waiting on you. Confirming one books the stay and records the money in your books.`}
                action={<Badge text={`${awaiting.length} waiting`} colour="var(--warn)" />}
              >
                <div style={{ display: 'grid', gap: 8 }}>
                  {awaiting.map(b => (
                    <button
                      key={b.id}
                      onClick={() => openBooking(b)}
                      style={{
                        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px',
                        width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 10,
                        border: '1px solid var(--border-md)', borderLeft: '2px solid var(--warn)',
                        background: 'var(--bg-badge)', cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.6, color: 'var(--text-1)' }}>
                        {guestName(b) || 'No name given'}
                      </span>
                      <span style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)' }}>
                        {shortDate(b.check_in)} to {shortDate(b.check_out)} · {nightsLabel(b)} · {unitName(b.unit_id)}
                      </span>
                      {/* Still in the queue, no longer standing in anyone's way.
                          Saying nothing would have the owner believe the room is
                          being kept when the website can already sell it. */}
                      {b.holding === false && (
                        <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, color: 'var(--warn)' }}>
                          Waited too long, so the dates are open again
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.6, color: 'var(--text-2)' }}>
                          {fmt(b.total_amount || 0, false, bookingSymbol(b))}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, color: 'var(--cyan)' }}>Answer</span>
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

          {/* Hero: multi-unit availability calendar */}
          <SectionCard
            title="Availability" explainId="hospitality.calendar"
            subtitle={loading ? 'Loading…' : `${days[0].toLocaleDateString([], { day: 'numeric', month: 'short' })} to ${days[WINDOW - 1].toLocaleDateString([], { day: 'numeric', month: 'short' })}`}
            action={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button aria-label="Previous week" onClick={() => setGridStart(addDays(gridStart, -7))} style={navBtn}>‹</button>
                <button onClick={() => setGridStart(startOfDay(new Date()))} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 15, fontWeight: 700 }}>Today</button>
                <button aria-label="Next week" onClick={() => setGridStart(addDays(gridStart, 7))} style={navBtn}>›</button>
                {/* Any date in one step. A stay months away used to take a press
                    of Next week for every week in between. */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: 'var(--text-3)' }}>
                  Go to
                  <input
                    type="date"
                    aria-label="Show the calendar from this date"
                    value={iso(gridStart)}
                    onChange={e => { if (e.target.value) setGridStart(parseISO(e.target.value)); }}
                    style={{ height: 34, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-badge)', color: 'var(--text-1)', fontSize: 16 }}
                  />
                </label>
                <button onClick={() => openDraft('')} style={primaryBtn}>+ Booking</button>
              </div>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 720 }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${WINDOW}, 1fr)`, gap: 2, marginBottom: 4 }}>
                  <div />
                  {days.map((d, i) => {
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = iso(d) === iso(new Date());
                    return (
                      <div key={i} style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', color: isToday ? 'var(--cyan)' : weekend ? 'var(--text-3)' : 'var(--text-4)', textTransform: 'uppercase' }}>
                        <div>{d.toLocaleDateString([], { weekday: 'narrow' })}</div>
                        <div style={{ fontSize: 15, letterSpacing: 0, color: isToday ? 'var(--cyan)' : 'var(--text-2)' }}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Unit rows */}
                {units.map(u => (
                  <div key={u.id} style={{ display: 'grid', gridTemplateColumns: `160px repeat(${WINDOW}, 1fr)`, gap: 2, marginBottom: 2 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 8px', minWidth: 0 }}>
                      <span style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.6, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.unit_name}</span>
                      <span style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-4)' }}>{fmt(u.base_nightly_rate, false, symbolForToken(u.currency) || sym)}/night</span>
                    </div>
                    {days.map((d, i) => {
                      const bk = occupancyOn(u.id, d);
                      const isStart = bk && iso(parseISO(bk.check_in)) === iso(d);
                      const colour = bk ? statusColour(bk.status) : undefined;
                      return (
                        <button
                          key={i}
                          onClick={() => bk ? openBooking(bk) : openDraft(u.id, d)}
                          // The cell is a coloured block with no room for a name, so the
                          // name lives here: hovering answers "whose booking is that".
                          title={bk
                            ? `${guestName(bk) || 'No name given'} · ${statusLabel(bk.status)} · ${shortDate(bk.check_in)} to ${shortDate(bk.check_out)}`
                            : 'Free. Click to book.'}
                          style={{
                            height: 34, borderRadius: 5, cursor: 'pointer',
                            border: bk ? 'none' : '1px dashed var(--border)',
                            background: bk ? `color-mix(in srgb, ${colour} 24%, transparent)` : 'transparent',
                            borderLeft: isStart ? `3px solid ${colour}` : (bk ? 'none' : '1px dashed var(--border)'),
                            display: 'flex', alignItems: 'center', paddingLeft: 4, overflow: 'hidden',
                          }}
                        >
                          {isStart && bk?.channel_id && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>OTA</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend + the "it's all connected" note */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              {(['confirmed', 'pending', 'completed'] as BookingStatus[]).map(s => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: `color-mix(in srgb, ${statusColour(s)} 40%, transparent)`, border: `1px solid ${statusColour(s)}` }} />
                  {statusLabel(s)}
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)' }}>
                Confirmed bookings post to your books:{' '}
                <Link href="/dashboard/cash" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Cash Intel</Link>
                {' · '}
                <Link href="/dashboard/timeline" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Timeline</Link>
              </span>
            </div>
          </SectionCard>

          {/* New-booking form */}
          {draft && (
            <SectionCard title="New booking" subtitle="A confirmed booking with an amount records a Sale in your books. It counts as money owed to you until the guest pays.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={lbl}>Unit</label>
                  <select style={input} value={draft.unit_id} onChange={e => setDraft({ ...draft, unit_id: e.target.value })}>
                    {units.map(u => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Guest name</label><input style={input} value={draft.guest} onChange={e => setDraft({ ...draft, guest: e.target.value })} placeholder="Optional. Saves the guest" /></div>
                <div><label style={lbl}>Check-in</label><input style={input} type="date" value={draft.check_in} onChange={e => setDraft({ ...draft, check_in: e.target.value, check_out: e.target.value >= draft.check_out ? iso(addDays(parseISO(e.target.value), 1)) : draft.check_out })} /></div>
                <div><label style={lbl}>Check-out</label><input style={input} type="date" value={draft.check_out} min={draft.check_in} onChange={e => setDraft({ ...draft, check_out: e.target.value })} /></div>
                <div><label style={lbl}>Guests</label><input style={input} type="number" min="1" value={draft.guests} onChange={e => setDraft({ ...draft, guests: e.target.value })} /></div>
                <div><label style={lbl}>Total ({sym})</label><input style={input} type="number" min="0" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="Records revenue" /></div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={input} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as BookingStatus })}>
                    {(['confirmed', 'pending'] as BookingStatus[]).map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Paid?</label>
                  <select style={input} value={draft.paid} onChange={e => setDraft({ ...draft, paid: e.target.value as PaymentStatus })}>
                    {(['unpaid', 'paid'] as PaymentStatus[]).map(s => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <button style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={busy || !draft.unit_id} onClick={submitBooking}>{busy ? 'Saving…' : 'Save booking'}</button>
                <button style={quietBtn} onClick={() => setDraft(null)}>Discard</button>
              </div>
            </SectionCard>
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
                onSaved={(b) => { applyUpdate(b); void load(gridStart); }}
                onClose={closeBooking}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

const navBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-badge)',
  color: 'var(--text-2)', cursor: 'pointer', fontSize: '1.125rem', lineHeight: 1,
};

// ── The booking panel ────────────────────────────────────────────────────────

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

function BookingPanel({
  booking: b, unitName, busy, note, emailNote, declining, declineReason,
  onDeclineReason, onStartDecline, onStopDecline, onConfirm, onDecline, onCancel, onPayment, onSaved, onClose,
}: PanelProps) {
  const g = b.guest;
  const name = guestName(b);
  const phone = guestPhone(b);
  const email = guestEmail(b);
  const symbol = bookingSymbol(b);
  const colour = statusColour(b.status);

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

  return (
    <SectionCard
      title="Booking"
      subtitle={unitName}
      action={<button aria-label="Close this booking" onClick={onClose} style={{ ...navBtn, width: 34 }}>✕</button>}
    >
      {/* WHO */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4, color: 'var(--text-1)' }}>
          {name || 'No name on this booking'}
        </span>
        <Badge text={statusLabel(b.status)} colour={colour} />
        {g?.vip_flag && <Badge text="VIP" colour="var(--warn)" />}
        {g?.is_repeat_guest && (
          <Badge text={g.stay_count && g.stay_count > 1 ? `Repeat guest · ${g.stay_count} stays` : 'Repeat guest'} colour="var(--info)" />
        )}
      </div>

      {(b.organisation || '').trim() && (
        <div style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text-2)', marginTop: 4 }}>{b.organisation}</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        {phone && <ContactLink href={`tel:${phone.replace(/[^\d+]/g, '')}`} label="Call" value={phone} />}
        {email && <ContactLink href={`mailto:${email}`} label="Email" value={email} />}
        {!phone && !email && (
          <span style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text-4)' }}>No phone number or email on this booking.</span>
        )}
      </div>

      {/* WHEN */}
      <PanelBlock title="When">
        <FieldGrid>
          <Field label="Arrives" value={longDate(b.check_in)} hint={b.arrival_time ? `From ${String(b.arrival_time).slice(0, 5)}` : undefined} />
          <Field label="Leaves" value={longDate(b.check_out)} />
          <Field label="Nights" value={nightsLabel(b)} />
          {b.created_at && <Field label="Request came in" value={stamp(b.created_at)} />}
        </FieldGrid>
      </PanelBlock>

      {/* WHAT */}
      <PanelBlock title="What they booked">
        <FieldGrid>
          <Field label="Unit" value={unitName} />
          <Field label="People staying" value={`${b.guests_count} guest${b.guests_count === 1 ? '' : 's'}`} />
          <Field label="Amount" value={fmt(b.total_amount || 0, false, symbol)} />
          {showQuoted && <Field label="You quoted" value={fmt(quoted || 0, false, symbol)} hint="Different from the amount above" />}
          {!earns && <Field label="Payment" value={PAYMENT_LABEL[b.payment_status] ?? sentence(b.payment_status)} colour={PAYMENT_COLOUR[b.payment_status]} hint={sentence(b.payment_method) || undefined} />}
          {b.reference && <Field label="Their reference" value={b.reference} hint="The code the guest was given" />}
          <Field label="Came from" value={sourceLabel(b)} />
          {b.purpose && <Field label="Reason for the stay" value={sentence(b.purpose)} />}
          <Field
            label="In your books"
            value={b.linked_event_id ? 'Yes, posted' : waiting ? 'Not until you confirm' : 'Not posted'}
            colour={b.linked_event_id ? 'var(--good)' : 'var(--text-3)'}
          />
        </FieldGrid>
      </PanelBlock>

      {/* WHAT THEY HAVE PAID */}
      {earns && (
        <PanelBlock title="Money from this stay" tone={PAYMENT_COLOUR[payment]}>
          <p style={{ margin: '0 0 12px', fontSize: 18, lineHeight: 1.6, fontWeight: 600, color: 'var(--text-1)' }}>{moneySummary}</p>
          {b.payment_method && (
            <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.6, color: 'var(--text-4)' }}>
              The guest said they would pay by {sentence(b.payment_method).toLowerCase()}.
            </p>
          )}
          <div role="group" aria-label="What the guest has paid" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(['unpaid', 'partial', 'paid', 'refunded'] as PaymentStatus[]).map(s => {
              const on = takingDeposit ? s === 'partial' : payment === s;
              return (
                <button
                  key={s}
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => choose(s)}
                  style={{
                    ...quietBtn, fontSize: 16, padding: '8px 14px', opacity: busy ? 0.7 : 1,
                    color: on ? 'var(--text-1)' : 'var(--text-2)',
                    background: on ? `color-mix(in srgb, ${PAYMENT_COLOUR[s]} 16%, transparent)` : 'transparent',
                    border: `1px solid ${on ? PAYMENT_COLOUR[s] : 'var(--border-md)'}`,
                  }}
                >
                  {s === 'partial' ? 'Deposit paid' : PAYMENT_LABEL[s]}
                </button>
              );
            })}
          </div>
          <Instalments booking={b} symbol={symbol} owed={total - paidSoFar} onSaved={onSaved} />
          {takingDeposit && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end', marginTop: 12, maxWidth: 520 }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={lbl} htmlFor="deposit-amount">Deposit received ({symbol})</label>
                <input
                  id="deposit-amount"
                  style={input}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={deposit}
                  onChange={e => setDeposit(e.target.value)}
                  placeholder={`Less than ${fmt(total, false, symbol)}`}
                />
              </div>
              <button style={{ ...primaryBtn, opacity: busy || !depositOk ? 0.7 : 1 }} disabled={busy || !depositOk} onClick={saveDeposit}>
                {busy ? 'Saving…' : 'Save deposit'}
              </button>
              <button style={quietBtn} disabled={busy} onClick={() => setTakingDeposit(false)}>Never mind</button>
              {deposit.trim() !== '' && !depositOk && (
                <p style={{ flexBasis: '100%', margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--warn)' }}>
                  A deposit is more than nothing and less than the whole {fmt(total, false, symbol)}. If they paid it all, choose Paid in full.
                </p>
              )}
            </div>
          )}
        </PanelBlock>
      )}

      {/* KEPT WHEN CALLED OFF (upgrade 5) */}
      {(b.status === 'cancelled' || b.status === 'no_show') && (b.kept_amount || 0) > 0 && b.payment_status !== 'refunded' && (
        <PanelBlock title="Money from this stay" tone="var(--good)">
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, fontWeight: 600, color: 'var(--text-1)' }}>
            You kept {fmt(b.kept_amount || 0, false, symbol)} when this stay was called off. It stays in your books as income.
          </p>
        </PanelBlock>
      )}

      {/* A LINK THE GUEST PAYS FROM (upgrade 3) */}
      {earns && payment !== 'paid' && payment !== 'refunded' && (
        <PayLinkBlock booking={b} owed={total - paidSoFar} symbol={symbol} unitName={unitName} phone={phone} name={name} />
      )}

      {/* THEIR WORDS */}
      {(b.guest_notes || '').trim() && (
        <PanelBlock title="What the guest wrote" tone="var(--info)">
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{b.guest_notes}</p>
        </PanelBlock>
      )}

      {myNote && (
        <PanelBlock title="Your note about this guest">
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{myNote}</p>
        </PanelBlock>
      )}

      {/* THE DECISION */}
      {(b.confirmed_at || b.declined_at || b.cancelled_at) && (
        <PanelBlock title="The decision" tone={colour}>
          <div style={{ display: 'grid', gap: 6 }}>
            {b.confirmed_at && <DecisionLine text={`Confirmed on ${stamp(b.confirmed_at)}`} colour="var(--good)" />}
            {b.declined_at && <DecisionLine text={`Turned down on ${stamp(b.declined_at)}`} colour="var(--text-3)" />}
            {b.cancelled_at && <DecisionLine text={`Cancelled on ${stamp(b.cancelled_at)}`} colour="var(--text-3)" />}
            {(b.decline_reason || '').trim() && (
              <div style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text-2)' }}>Reason given: {b.decline_reason}</div>
            )}
          </div>
        </PanelBlock>
      )}

      {/* EMAILS TO THE GUEST: so "did they hear from us?" never needs a phone call. */}
      {b.guest_emails && Object.keys(b.guest_emails).length > 0 && (
        <PanelBlock title="Emails to the guest">
          <div style={{ display: 'grid', gap: 6 }}>
            {b.guest_emails.received && <DecisionLine text={`Request received, sent ${stamp(b.guest_emails.received)}`} colour="var(--text-3)" />}
            {b.guest_emails.confirmed && <DecisionLine text={`Booking confirmed, sent ${stamp(b.guest_emails.confirmed)}`} colour="var(--good)" />}
            {b.guest_emails.declined && <DecisionLine text={`Request turned down, sent ${stamp(b.guest_emails.declined)}`} colour="var(--text-3)" />}
          </div>
        </PanelBlock>
      )}

      {emailNote && (
        <div style={{
          marginTop: 20, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-badge)', fontSize: 18, lineHeight: 1.6,
          border: `1px solid ${emailNote.tone === 'good' ? 'var(--good)' : 'var(--warn)'}`, color: 'var(--text-1)',
        }}>
          {emailNote.text}
        </div>
      )}

      {/* Something went wrong on the last action, said plainly. */}
      {note && (
        <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 10, background: 'var(--red-dim)', border: '1px solid var(--crit)', color: 'var(--crit)', fontSize: 18, lineHeight: 1.6 }}>
          {note}
        </div>
      )}

      {/* THE ACTIONS */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {waiting && !declining && (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 18, lineHeight: 1.6, color: 'var(--text-3)' }}>
              Confirming holds the dates for this guest and records the money in your books. Turning it down frees the nights straight away.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                style={{ ...primaryBtn, background: 'var(--good)', color: '#04150f', opacity: busy ? 0.7 : 1 }}
                disabled={busy}
                onClick={onConfirm}
              >
                {busy ? 'Confirming…' : 'Confirm and put it in the books'}
              </button>
              <button style={{ ...quietBtn, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={onStartDecline}>
                Turn it down
              </button>
            </div>
          </>
        )}

        {waiting && declining && (
          <div style={{ maxWidth: 520 }}>
            <label style={lbl} htmlFor="decline-reason">Why are you turning it down?</label>
            <input
              id="decline-reason"
              style={input}
              value={declineReason}
              onChange={e => onDeclineReason(e.target.value)}
              placeholder="Optional. The guest never sees this"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <button
                style={{ ...primaryBtn, background: 'transparent', color: 'var(--crit)', border: '1px solid var(--crit)', opacity: busy ? 0.7 : 1 }}
                disabled={busy}
                onClick={onDecline}
              >
                {busy ? 'Turning it down…' : 'Turn down this request'}
              </button>
              <button style={quietBtn} disabled={busy} onClick={onStopDecline}>Keep it waiting</button>
            </div>
          </div>
        )}

        {cancellable && (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 18, lineHeight: 1.6, color: 'var(--text-3)' }}>
              This stay is booked. Cancelling frees the nights for somebody else.
              {paidSoFar > 0 && ` The guest has paid ${fmt(paidSoFar, false, symbol)}: keep it (a deposit they lose) or refund it.`}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                style={{ ...primaryBtn, background: 'var(--red-dim)', color: 'var(--crit)', border: '1px solid var(--crit)', opacity: busy ? 0.7 : 1 }}
                disabled={busy}
                onClick={() => onCancel(false)}
              >
                {busy ? 'Cancelling…' : paidSoFar > 0 ? `Cancel and keep the ${fmt(paidSoFar, false, symbol)}` : 'Cancel this booking'}
              </button>
              {paidSoFar > 0 && (
                <button style={{ ...quietBtn, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={() => onCancel(true)}>
                  Cancel and refund it
                </button>
              )}
            </div>
          </>
        )}

        {!waiting && !cancellable && (
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: 'var(--text-4)' }}>
            This booking is closed. Nothing left to answer.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

/** A named group with the 2px line indicator the design system uses to bind a
 *  block of facts together without drawing another card inside a card. */
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
    if (!window.confirm(`Take the ${fmt(p.amount, false, symbol)} payment of ${shortDate(p.date)} off this stay? It comes out of your books.`)) return;
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
    <div style={{ marginTop: 14 }}>
      {list && list.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
          <div style={{ ...lbl, marginBottom: 0 }}>Payments received</div>
          {list.map((p) => (
            <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)' }}>{fmt(p.amount, false, symbol)}</span>
              <span style={{ fontSize: 16, color: 'var(--text-3)' }}>{shortDate(p.date)} · {METHOD_LABEL[p.method] ?? p.method}</span>
              <button onClick={() => remove(p)} disabled={busy}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-3)', textDecoration: 'underline', fontSize: 15, cursor: 'pointer', padding: 4 }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {owed > 0.005 && !adding && (
        <button style={{ ...quietBtn, fontSize: 16, padding: '8px 14px' }} disabled={busy} onClick={() => setAdding(true)}>
          + Add a payment
        </button>
      )}
      {adding && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, alignItems: 'end', maxWidth: 640 }}>
          <div>
            <label style={lbl} htmlFor="inst-amount">Amount ({symbol})</label>
            <input id="inst-amount" style={input} type="number" min="0" step="0.01" inputMode="decimal"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Up to ${fmt(owed, false, symbol)}`} />
          </div>
          <div>
            <label style={lbl} htmlFor="inst-day">Paid on</label>
            <input id="inst-day" style={input} type="date" max={today} value={day} onChange={e => setDay(e.target.value)} />
          </div>
          <div>
            <label style={lbl} htmlFor="inst-method">How</label>
            <select id="inst-method" style={input} value={method} onChange={e => setMethod(e.target.value as StayPaymentMethod)}>
              {(Object.keys(METHOD_LABEL) as StayPaymentMethod[]).map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...primaryBtn, opacity: busy || !ok ? 0.7 : 1 }} disabled={busy || !ok} onClick={add}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button style={quietBtn} disabled={busy} onClick={() => { setAdding(false); setError(''); }}>Cancel</button>
          </div>
        </div>
      )}
      {amount.trim() !== '' && value > owed + 0.005 && (
        <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.6, color: 'var(--warn)' }}>
          That is more than the {fmt(owed, false, symbol)} still owed.
        </p>
      )}
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.6, color: 'var(--crit)' }}>{error}</p>}
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
    <PanelBlock title="Payment link for the guest" tone="var(--cyan)">
      <p style={{ margin: '0 0 12px', fontSize: 18, lineHeight: 1.6, color: 'var(--text-2)' }}>
        Send the guest a link. They pay by mobile money from their phone, and this booking marks itself paid.
      </p>
      <div role="group" aria-label="How much the link asks for" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {(['all', 'deposit'] as const).map(m => (
          <button
            key={m}
            aria-pressed={mode === m}
            onClick={() => { setMode(m); setLink(null); }}
            style={{
              ...quietBtn, fontSize: 16, padding: '8px 14px',
              color: mode === m ? 'var(--text-1)' : 'var(--text-2)',
              background: mode === m ? 'color-mix(in srgb, var(--cyan) 16%, transparent)' : 'transparent',
              border: `1px solid ${mode === m ? 'var(--cyan)' : 'var(--border-md)'}`,
            }}
          >
            {m === 'all' ? `Everything owed (${fmt(owed, false, symbol)})` : 'A deposit'}
          </button>
        ))}
      </div>
      {mode === 'deposit' && (
        <div style={{ maxWidth: 320, marginBottom: 12 }}>
          <label style={lbl} htmlFor="link-deposit">Deposit to ask for ({symbol})</label>
          <input id="link-deposit" style={input} type="number" min="0" step="0.01" inputMode="decimal"
            value={deposit} onChange={e => { setDeposit(e.target.value); setLink(null); }}
            placeholder={`Less than ${fmt(owed, false, symbol)}`} />
        </div>
      )}
      <button
        style={{ ...primaryBtn, opacity: busy || (mode === 'deposit' && !depositOk) ? 0.7 : 1 }}
        disabled={busy || (mode === 'deposit' && !depositOk)}
        onClick={make}
      >
        {busy ? 'Making the link…' : link ? 'Make it again' : 'Make the link'}
      </button>
      {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: 'var(--crit)' }}>{error}</p>}
      {link && (
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-badge)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>
            Asks for {fmt(link.requested, false, symbol)}
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text-1)', wordBreak: 'break-all', marginBottom: 10 }}>{link.url}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button style={{ ...quietBtn, fontSize: 16, padding: '8px 14px' }} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ ...primaryBtn, fontSize: 16, padding: '8px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              {waNumber ? 'Send on WhatsApp' : 'Share on WhatsApp'}
            </a>
          </div>
        </div>
      )}
    </PanelBlock>
  );
}

function PanelBlock({ title, children, tone = 'var(--border-md)' }: { title: string; children: React.ReactNode; tone?: string }) {
  return (
    <section style={{ marginTop: 24, paddingLeft: 14, borderLeft: `2px solid ${tone}` }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-4)' }}>
        {title}
      </h4>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px 24px' }}>{children}</div>;
}

function Field({ label, value, colour, hint }: { label: string; value: string; colour?: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.6, color: colour || 'var(--text-1)', marginTop: 2 }}>{value}</div>
      {hint && <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-4)' }}>{hint}</div>}
    </div>
  );
}

function Badge({ text, colour }: { text: string; colour: string }) {
  return (
    <span style={{
      fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      color: colour, background: `color-mix(in srgb, ${colour} 16%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colour} 40%, transparent)`, borderRadius: 6, padding: '5px 10px',
    }}>
      {text}
    </span>
  );
}

/** Phone and email as one tap. On a phone this dials; on a laptop it opens mail. */
function ContactLink({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 8, padding: '10px 14px', minHeight: 44,
        borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-badge)',
        fontSize: 18, lineHeight: 1.6, color: 'var(--text-1)', textDecoration: 'none',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </a>
  );
}

function DecisionLine({ text, colour }: { text: string; colour: string }) {
  return <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.6, color: colour }}>{text}</div>;
}
