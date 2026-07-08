'use client';
/**
 * AI-BOS — Hospitality hub (short-let PMS).
 *
 * One screen to run the property day-to-day, per the build spec's north star:
 * the multi-unit availability calendar is the hero — the one place staff check
 * instead of opening Booking.com / RentByOwner / CASAI / FVRentals separately.
 *
 * Everything recorded here already lives inside AI-BOS: a confirmed booking posts
 * a Sale and each expense posts an Expense to the event spine on the server, so the
 * numbers surface in Cash Intel, Timeline and the P&L with no extra entry. This page
 * keeps that promise visible (the "in your books" note) rather than feeling bolted on.
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
  listProperties, listUnits, listBookings, createBooking, cancelBooking,
  createProperty, createUnit, createGuest, occupancyRate,
  type Property, type Unit, type Booking, type BookingStatus,
} from '@/lib/hospitality';

// ── Date helpers (browser zone — CAT for Lusaka) ─────────────────────────────
const DAY_MS = 86_400_000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s: string) => new Date(s + 'T00:00:00');
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const WINDOW = 14; // days shown across the calendar

// Status → colour (visual_language_system: colour carries meaning).
const STATUS_COLOUR: Record<BookingStatus, string> = {
  confirmed: 'var(--green)',
  pending:   'var(--amber)',
  completed: 'var(--text-3)',
  cancelled: 'var(--text-4)',
  no_show:   'var(--red)',
};
const BLOCKING: BookingStatus[] = ['confirmed', 'pending', 'completed'];

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontFamily: 'Geist, sans-serif', fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};
const primaryBtn: React.CSSProperties = {
  padding: '9px 16px', minHeight: 38, borderRadius: 8, border: 'none', background: 'var(--cyan)',
  color: '#fff', fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
};

interface Draft { unit_id: string; guest: string; check_in: string; check_out: string; guests: string; amount: string; status: BookingStatus; }
const emptyDraft = (unitId = '', checkIn = iso(new Date())): Draft => ({
  unit_id: unitId, guest: '', check_in: checkIn, check_out: iso(addDays(parseISO(checkIn), 1)),
  guests: '1', amount: '', status: 'confirmed',
});

export default function HospitalityPage() {
  const tier = useStore(s => s.tier) as Tier;
  const entitled = canAccess(tier, 'hospitality');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [gridStart, setGridStart] = useState(() => startOfDay(new Date()));

  // Panels
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);

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
      const bk = us.length ? await listBookings({ from: iso(from), to: iso(to) }) : [];
      setBookings(bk);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load hospitality data.');
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => { if (entitled) load(gridStart); }, [entitled, gridStart, load]);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const days = useMemo(() => Array.from({ length: WINDOW }, (_, i) => addDays(gridStart, i)), [gridStart]);

  const monthBookings = useMemo(
    () => bookings.filter(b => { const ci = parseISO(b.check_in); return ci >= monthStart && ci < monthEnd; }),
    [bookings, monthStart, monthEnd],
  );
  const occupancy = useMemo(() => occupancyRate(units, bookings, monthStart, monthEnd), [units, bookings, monthStart, monthEnd]);
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
      return ci >= today && ci < soon && BLOCKING.includes(b.status);
    }).length;
  }, [bookings]);

  /** The blocking booking occupying a given unit on a given day, if any. */
  const occupancyOn = useCallback((unitId: string, day: Date): Booking | undefined => {
    const t = day.getTime();
    return bookings.find(b =>
      b.unit_id === unitId && BLOCKING.includes(b.status) &&
      parseISO(b.check_in).getTime() <= t && parseISO(b.check_out).getTime() > t,
    );
  }, [bookings]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const openDraft = (unitId: string, day?: Date) => {
    setSelected(null);
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
      });
      setDraft(null);
      await load(gridStart);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the booking.');
    } finally { setBusy(false); }
  };

  const doCancel = async (id: string) => {
    setBusy(true); setError('');
    try { await cancelBooking(id); setSelected(null); await load(gridStart); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel.'); }
    finally { setBusy(false); }
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
            title="Hospitality — Property Operations"
            headline="Run your short-lets from one calendar."
            detail="Multi-unit availability, direct bookings, guest CRM, channel sync and per-property P&L — all feeding your existing AI-BOS books automatically."
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
        <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      {/* First-run setup — create the single source of truth for a listing. */}
      {noUnits && (
        <SectionCard title="Add your first property" subtitle="One record per unit becomes the single source of truth every channel pulls from.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div><label style={lbl}>Property name</label><input style={input} value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="Dunslim Apartments" /></div>
            <div><label style={lbl}>First unit</label><input style={input} value={setupUnit} onChange={e => setSetupUnit(e.target.value)} placeholder="Unit A — 2BR" /></div>
            <div><label style={lbl}>Nightly rate ({sym})</label><input style={input} type="number" min="0" value={setupRate} onChange={e => setSetupRate(e.target.value)} placeholder="850" /></div>
            <button style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={runSetup}>{busy ? 'Creating…' : 'Create'}</button>
          </div>
        </SectionCard>
      )}

      {!noUnits && (
        <>
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
            subtitle={loading ? 'Loading…' : `${days[0].toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${days[WINDOW - 1].toLocaleDateString([], { day: 'numeric', month: 'short' })}`}
            action={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button aria-label="Previous week" onClick={() => setGridStart(addDays(gridStart, -7))} style={navBtn}>‹</button>
                <button onClick={() => setGridStart(startOfDay(new Date()))} style={{ ...navBtn, width: 'auto', padding: '0 10px', fontSize: '0.7rem', fontWeight: 700 }}>Today</button>
                <button aria-label="Next week" onClick={() => setGridStart(addDays(gridStart, 7))} style={navBtn}>›</button>
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
                      <div key={i} style={{ textAlign: 'center', fontFamily: 'Geist, sans-serif', fontSize: '0.6rem', fontWeight: 700, color: isToday ? 'var(--cyan)' : weekend ? 'var(--text-3)' : 'var(--text-4)', textTransform: 'uppercase' }}>
                        <div>{d.toLocaleDateString([], { weekday: 'narrow' })}</div>
                        <div style={{ fontSize: '0.72rem', color: isToday ? 'var(--cyan)' : 'var(--text-2)' }}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Unit rows */}
                {units.map(u => (
                  <div key={u.id} style={{ display: 'grid', gridTemplateColumns: `160px repeat(${WINDOW}, 1fr)`, gap: 2, marginBottom: 2 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 8px', minWidth: 0 }}>
                      <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.unit_name}</span>
                      <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.62rem', color: 'var(--text-4)' }}>{fmt(u.base_nightly_rate, false, symbolForToken(u.currency) || sym)}/night</span>
                    </div>
                    {days.map((d, i) => {
                      const bk = occupancyOn(u.id, d);
                      const isStart = bk && iso(parseISO(bk.check_in)) === iso(d);
                      const colour = bk ? STATUS_COLOUR[bk.status] : undefined;
                      return (
                        <button
                          key={i}
                          onClick={() => bk ? setSelected(bk) : openDraft(u.id, d)}
                          title={bk ? `${bk.status} · ${bk.check_in}→${bk.check_out}` : 'Free — click to book'}
                          style={{
                            height: 34, borderRadius: 5, cursor: 'pointer',
                            border: bk ? 'none' : '1px dashed var(--border)',
                            background: bk ? `color-mix(in srgb, ${colour} 24%, transparent)` : 'transparent',
                            borderLeft: isStart ? `3px solid ${colour}` : (bk ? 'none' : '1px dashed var(--border)'),
                            display: 'flex', alignItems: 'center', paddingLeft: 4, overflow: 'hidden',
                          }}
                        >
                          {isStart && bk?.channel_id && <span style={{ fontSize: '0.55rem', color: 'var(--text-2)' }}>OTA</span>}
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
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-3)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: `color-mix(in srgb, ${STATUS_COLOUR[s]} 40%, transparent)`, border: `1px solid ${STATUS_COLOUR[s]}` }} />
                  {s}
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-3)' }}>
                Confirmed bookings post to your books —{' '}
                <Link href="/dashboard/cash" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Cash Intel</Link>
                {' · '}
                <Link href="/dashboard/timeline" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Timeline</Link>
              </span>
            </div>
          </SectionCard>

          {/* New-booking form */}
          {draft && (
            <SectionCard title="New booking" subtitle="A confirmed booking with an amount records a Sale in your books.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={lbl}>Unit</label>
                  <select style={input} value={draft.unit_id} onChange={e => setDraft({ ...draft, unit_id: e.target.value })}>
                    {units.map(u => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Guest name</label><input style={input} value={draft.guest} onChange={e => setDraft({ ...draft, guest: e.target.value })} placeholder="Optional — adds to CRM" /></div>
                <div><label style={lbl}>Check-in</label><input style={input} type="date" value={draft.check_in} onChange={e => setDraft({ ...draft, check_in: e.target.value, check_out: e.target.value >= draft.check_out ? iso(addDays(parseISO(e.target.value), 1)) : draft.check_out })} /></div>
                <div><label style={lbl}>Check-out</label><input style={input} type="date" value={draft.check_out} min={draft.check_in} onChange={e => setDraft({ ...draft, check_out: e.target.value })} /></div>
                <div><label style={lbl}>Guests</label><input style={input} type="number" min="1" value={draft.guests} onChange={e => setDraft({ ...draft, guests: e.target.value })} /></div>
                <div><label style={lbl}>Total ({sym})</label><input style={input} type="number" min="0" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="Records revenue" /></div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={input} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as BookingStatus })}>
                    {(['confirmed', 'pending'] as BookingStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={busy || !draft.unit_id} onClick={submitBooking}>{busy ? 'Saving…' : 'Save booking'}</button>
                <button style={{ ...primaryBtn, background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border-md)' }} onClick={() => setDraft(null)}>Cancel</button>
              </div>
            </SectionCard>
          )}

          {/* Booking detail */}
          {selected && (
            <SectionCard
              title="Booking"
              subtitle={units.find(u => u.id === selected.unit_id)?.unit_name}
              action={<button onClick={() => setSelected(null)} style={{ ...navBtn, width: 28 }}>✕</button>}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 14 }}>
                <Field label="Stay" value={`${selected.check_in} → ${selected.check_out}`} />
                <Field label="Guests" value={String(selected.guests_count)} />
                <Field label="Amount" value={fmt(selected.total_amount || 0, false, sym)} />
                <Field label="Status" value={selected.status} colour={STATUS_COLOUR[selected.status]} />
                <Field label="Source" value={selected.channel_id ? 'OTA (synced)' : 'Direct'} />
                <Field label="In books" value={selected.linked_event_id ? 'Yes' : '—'} colour={selected.linked_event_id ? 'var(--green)' : undefined} />
              </div>
              {selected.status !== 'cancelled' && (
                <button style={{ ...primaryBtn, background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red)', opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={() => doCancel(selected.id)}>
                  {busy ? 'Cancelling…' : 'Cancel booking'}
                </button>
              )}
            </SectionCard>
          )}
        </>
      )}
    </>
  );
}

const navBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-badge)',
  color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: '1rem', lineHeight: 1,
};

function Field({ label, value, colour }: { label: string; value: string; colour?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.86rem', fontWeight: 600, color: colour || 'var(--text-1)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

