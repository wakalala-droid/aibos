'use client';
/**
 * Bookings: the list.
 *
 * Until now the only way to reach a booking was to find its coloured cell on the
 * 14-day calendar. That answers "is the unit free on Friday". It never answers
 * "who is waiting on me", "did the Ndola family ever pay" or "what came in from
 * the website this week", because none of those questions start with a date.
 *
 * So the page opens on the one thing with a clock running on it: requests nobody
 * has answered. Confirming here is the same action the calendar takes. The
 * server posts the Sale to the spine, so the money lands in Cash Intel and the
 * P&L without a second entry.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SectionCard from '@/components/ui/SectionCard';
import { fmt } from '@/lib/currency';
import {
  listBookings, listUnits, confirmBooking, declineBooking,
  nights, bookingSymbol, SOURCE_LABEL,
  type Booking, type BookingStatus, type BookingSource, type Unit,
} from '@/lib/hospitality';

/** The server also answers 'declined' for a request that was never agreed to
 *  (hospitality.py BOOKING_STATUSES). The shared BookingStatus union has not
 *  caught up. lib/hospitality.ts is fixed, so this page carries the extra
 *  value locally instead of editing a type four other screens depend on. */
type RowStatus = BookingStatus | 'declined';

/* The shared type scale stops at 14px for body text, which is below the floor
   for anything an owner has to read off a screen at arm's length. This page
   pins its body copy to the 18px step and its supporting lines to 15px. 13px
   is the floor here: letterspaced caps headings only. */
const FS_BODY = 'var(--fs-h3)';    /* 18px */
const FS_SMALL = '0.9375rem';      /* 15px */
const FS_CAPS = 'var(--fs-data)';  /* 13px */

/** Status in the owner's words, with the colour that carries the meaning.
 *  "Pending" and "no_show" are database words: nobody running a guest house
 *  says them out loud. */
const STATUS_META: Record<RowStatus, { label: string; colour: string }> = {
  pending:   { label: 'Waiting on you', colour: 'var(--warn)'   },
  confirmed: { label: 'Confirmed',      colour: 'var(--good)'   },
  completed: { label: 'Stayed',         colour: 'var(--text-3)' },
  declined:  { label: 'Turned down',    colour: 'var(--text-4)' },
  cancelled: { label: 'Called off',     colour: 'var(--text-4)' },
  no_show:   { label: 'Never arrived',  colour: 'var(--crit)'   },
};
const statusMeta = (s: string) => STATUS_META[s as RowStatus] ?? { label: s, colour: 'var(--text-3)' };

/** The questions an owner actually asks, each as one chip. A set beats a single
 *  status because "what is live" is pending plus confirmed, never one of them. */
const VIEWS: { key: string; label: string; statuses: RowStatus[] }[] = [
  { key: 'pending',   label: 'Waiting on you', statuses: ['pending'] },
  { key: 'live',      label: 'Live bookings',  statuses: ['pending', 'confirmed'] },
  { key: 'confirmed', label: 'Confirmed',      statuses: ['confirmed'] },
  { key: 'stayed',    label: 'Stayed',         statuses: ['completed'] },
  { key: 'off',       label: 'Did not happen', statuses: ['declined', 'cancelled', 'no_show'] },
  { key: 'all',       label: 'Everything',     statuses: [] },
];

const SORTS: { key: 'check_in' | 'created_at'; label: string }[] = [
  { key: 'check_in',   label: 'By arrival date' },
  { key: 'created_at', label: 'By when it came in' },
];

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', minHeight: 44, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontSize: FS_SMALL, lineHeight: 1.6, outline: 'none',
};
const primaryBtn: React.CSSProperties = {
  padding: '10px 16px', minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--cyan)',
  color: '#fff', fontSize: FS_SMALL, fontWeight: 700, cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '10px 14px', minHeight: 44, borderRadius: 10, background: 'transparent',
  border: '1px solid var(--border-md)', color: 'var(--text-2)',
  fontSize: FS_SMALL, fontWeight: 600, cursor: 'pointer',
};
const capsLabel: React.CSSProperties = {
  fontSize: FS_CAPS, fontWeight: 700, color: 'var(--text-4)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

/** A stay reads "12 Sep", never "2026-09-12". The year appears only when the
 *  date is outside this one, where leaving it off would be a guess. */
function fmtDay(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], thisYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Whoever the booking is for. The joined guest record wins over the name typed
 *  on the request, because the CRM row is the one an owner has corrected. */
const guestName = (b: Booking) => b.guest?.full_name || b.guest_name || 'No name given';

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px',
      borderRadius: 6, fontSize: FS_SMALL, fontWeight: 600, whiteSpace: 'nowrap',
      color: m.colour,
      background: `color-mix(in srgb, ${m.colour} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${m.colour} 40%, transparent)`,
    }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 6, background: m.colour }} />
      {m.label}
    </span>
  );
}

const COLUMNS = 'minmax(200px, 1.5fr) minmax(120px, 1fr) minmax(150px, 1.1fr) minmax(110px, 0.8fr) minmax(150px, 0.9fr)';

export default function BookingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // The view opens on what needs an answer.
  const [view, setView] = useState('pending');
  const [source, setSource] = useState<BookingSource | ''>('');
  const [order, setOrder] = useState<'check_in' | 'created_at'>('check_in');
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');  // only what has been submitted

  const [busyId, setBusyId] = useState('');
  const [decliningId, setDecliningId] = useState('');
  const [reason, setReason] = useState('');

  // Units are the row labels, not a filter, so they load once and stay put.
  useEffect(() => {
    // A failure here costs the unit names, never the list itself, so it stays
    // quiet: every row still reads with "Unit removed" in that column.
    listUnits().then(setUnits).catch(() => { /* names are a nicety, not the data */ });
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const statuses = VIEWS.find(v => v.key === view)?.statuses ?? [];
      setBookings(await listBookings({
        // The one place 'declined' crosses the contract boundary. The server
        // accepts it, the shared union predates it.
        statuses: statuses.length ? (statuses as BookingStatus[]) : undefined,
        source: source || undefined,
        search: search || undefined,
        order,
        // The server matches the search term AFTER the limit is applied, so a
        // capped read plus a search would silently skip matches further down.
        limit: search ? undefined : 200,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your bookings.');
    } finally {
      setLoading(false);
    }
  }, [view, source, search, order]);

  useEffect(() => { load(); }, [load]);

  const unitName = useCallback(
    (id: string) => units.find(u => u.id === id)?.unit_name ?? 'Unit removed',
    [units],
  );

  /** Whatever order is chosen, an unanswered request sits at the top: it is the
   *  only row on this page where waiting costs the owner a booking. Sort is
   *  stable, so the chosen order still holds inside each group. */
  const rows = useMemo(
    () => [...bookings].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending')),
    [bookings],
  );
  const waiting = useMemo(() => rows.filter(b => b.status === 'pending').length, [rows]);

  const answer = async (id: string, yes: boolean) => {
    setBusyId(id); setError('');
    try {
      if (yes) await confirmBooking(id);
      else await declineBooking(id, reason.trim() || undefined);
      setDecliningId(''); setReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that answer.');
    } finally {
      setBusyId('');
    }
  };

  const subtitle = loading
    ? 'Loading…'
    : waiting > 0
      ? `${waiting} request${waiting === 1 ? '' : 's'} waiting on your answer`
      : `${rows.length} booking${rows.length === 1 ? '' : 's'}`;

  return (
    <>
      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: FS_SMALL, lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      <SectionCard
        title="Bookings"
        subtitle={subtitle}
        action={
          <Link href="/dashboard/hospitality" style={{ ...ghostBtn, display: 'inline-block', textDecoration: 'none' }}>
            Open the calendar
          </Link>
        }
      >
        {/* Search. One box, because an owner types whatever they remember: a
            name, the reference on the message, a phone number or the company. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <input
            style={{ ...inputStyle, flex: 1, minWidth: 220 }}
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setSearch(typed.trim()); }}
            placeholder="Search a name, reference, phone or company"
            aria-label="Search bookings"
          />
          <button style={ghostBtn} onClick={() => setSearch(typed.trim())}>Search</button>
          {search && (
            <button style={ghostBtn} onClick={() => { setTyped(''); setSearch(''); }}>Clear</button>
          )}
        </div>

        {/* Views + source + sort */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          {VIEWS.map(v => {
            const on = v.key === view;
            return (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                aria-pressed={on}
                style={{
                  padding: '8px 14px', minHeight: 40, borderRadius: 10, cursor: 'pointer',
                  fontSize: FS_SMALL, fontWeight: on ? 700 : 600,
                  color: on ? 'var(--text-1)' : 'var(--text-3)',
                  background: on ? 'var(--bg-badge)' : 'transparent',
                  border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border)'}`,
                }}
              >
                {v.label}
              </button>
            );
          })}

          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <select
              style={inputStyle}
              value={source}
              onChange={e => setSource(e.target.value as BookingSource | '')}
              aria-label="Filter by where the booking came from"
            >
              <option value="">Every source</option>
              {(Object.keys(SOURCE_LABEL) as BookingSource[]).map(s => (
                <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
              ))}
            </select>
            <select
              style={inputStyle}
              value={order}
              onChange={e => setOrder(e.target.value as 'check_in' | 'created_at')}
              aria-label="Sort the list"
            >
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* The list */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 860 }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 12, padding: '0 12px 8px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={capsLabel}>Guest</span>
              <span style={capsLabel}>Unit</span>
              <span style={capsLabel}>Stay</span>
              <span style={{ ...capsLabel, textAlign: 'right' }}>Amount</span>
              <span style={capsLabel}>Status</span>
            </div>

            {rows.map(b => {
              const m = statusMeta(b.status);
              const nightCount = nights(b);
              return (
                <div key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* The 2px edge is the status indicator: the eye finds the
                      amber rows before it reads a single word. */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: COLUMNS, gap: 12,
                    padding: '16px 12px', borderLeft: `2px solid ${m.colour}`,
                    alignItems: 'center',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: FS_BODY, lineHeight: 1.6, fontWeight: 600, color: 'var(--text-1)' }}>
                        {guestName(b)}
                      </div>
                      <div style={{ fontSize: FS_SMALL, lineHeight: 1.6, color: 'var(--text-3)' }}>
                        {[
                          b.reference ? `Ref ${b.reference}` : null,
                          b.source ? SOURCE_LABEL[b.source] : null,
                          b.organisation,
                        ].filter(Boolean).join(' · ') || 'No reference'}
                      </div>
                    </div>

                    <div style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-2)', minWidth: 0 }}>
                      {unitName(b.unit_id)}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-1)' }}>
                        {fmtDay(b.check_in)} <span style={{ color: 'var(--text-4)' }}>to</span> {fmtDay(b.check_out)}
                      </div>
                      <div style={{ fontSize: FS_SMALL, lineHeight: 1.6, color: 'var(--text-3)' }}>
                        {nightCount} night{nightCount === 1 ? '' : 's'}
                      </div>
                      {/* An unanswered website request stops holding its nights
                          after a day, so the calendar and the website can sell
                          them. It stays here to be answered, and the row has to
                          say which of the two is true. */}
                      {b.holding === false && (
                        <div style={{ fontSize: FS_SMALL, lineHeight: 1.6, fontWeight: 700, color: 'var(--warn)' }}>
                          Dates no longer held
                        </div>
                      )}
                    </div>

                    {/* The booking's OWN symbol. One unit priced in dollars and
                        another in kwacha is normal here. */}
                    <div style={{ fontSize: FS_BODY, lineHeight: 1.6, fontWeight: 700, color: 'var(--text-1)', textAlign: 'right' }}>
                      {fmt(b.total_amount || 0, false, bookingSymbol(b))}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <StatusBadge status={b.status} />
                      {b.status === 'pending' && (
                        <>
                          <button
                            style={{ ...primaryBtn, padding: '8px 14px', minHeight: 40, opacity: busyId === b.id ? 0.6 : 1 }}
                            disabled={busyId === b.id}
                            onClick={() => answer(b.id, true)}
                          >
                            {busyId === b.id ? 'Saving…' : 'Confirm'}
                          </button>
                          <button
                            style={{ ...ghostBtn, padding: '8px 14px', minHeight: 40 }}
                            disabled={busyId === b.id}
                            onClick={() => { setDecliningId(decliningId === b.id ? '' : b.id); setReason(''); }}
                          >
                            Turn down
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Turning down asks why, because the reason is what you read
                      back six months later when the same company writes again. */}
                  {decliningId === b.id && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '0 12px 16px 14px' }}>
                      <input
                        style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Why you turned it down (optional)"
                        aria-label="Reason for turning down this request"
                      />
                      <button
                        style={{ ...ghostBtn, color: 'var(--crit)', borderColor: 'var(--crit)', opacity: busyId === b.id ? 0.6 : 1 }}
                        disabled={busyId === b.id}
                        onClick={() => answer(b.id, false)}
                      >
                        {busyId === b.id ? 'Saving…' : 'Turn it down'}
                      </button>
                      <button style={ghostBtn} onClick={() => { setDecliningId(''); setReason(''); }}>Keep it</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!loading && rows.length === 0 && (
          <p style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-3)', marginTop: 16 }}>
            {search || source || view !== 'all' ? (
              <>
                Nothing here.{' '}
                <button
                  onClick={() => { setView('all'); setSource(''); setTyped(''); setSearch(''); }}
                  style={{ ...ghostBtn, minHeight: 0, padding: 0, border: 'none', color: 'var(--cyan)', textDecoration: 'underline' }}
                >
                  Show every booking
                </button>
              </>
            ) : (
              'No bookings yet. Stays you add on the calendar and requests from your website both land on this list.'
            )}
          </p>
        )}

        <p style={{ fontSize: FS_SMALL, lineHeight: 1.6, color: 'var(--text-4)', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          Confirming a booking records the sale in your books. You can see it in{' '}
          <Link href="/dashboard/cash" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Cash Intel</Link>.
          Turning one down changes nothing in the books: the dates simply go free again.
        </p>
      </SectionCard>
    </>
  );
}
