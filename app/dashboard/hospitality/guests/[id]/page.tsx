'use client';
/**
 * One guest: who they are plus every night they have ever paid for.
 *
 * The stay history has been sitting on the server since the module shipped
 * (GET /hospitality/guests/{id}/bookings) with nothing in the app able to reach
 * it, so the CRM could count a repeat guest but never show what they repeated.
 * This page is that read, plus the lifetime totals that tell an owner which
 * guests are worth a better rate.
 *
 * The sealed ID document is gated here exactly as it is on the guests list:
 * owner only. The server enforces the same rule, so a staff member seeing a
 * reveal button would only be watching it fail.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SectionCard from '@/components/ui/SectionCard';
import KPICard from '@/components/ui/KPICard';
import { useProfile } from '@/lib/profile';
import { fmt } from '@/lib/currency';
import {
  getGuest, listGuestBookings, listUnits,
  nights, bookingSymbol, SOURCE_LABEL,
  type Booking, type BookingStatus, type Guest, type Unit,
} from '@/lib/hospitality';

/** The server also answers 'declined' for a request that was never agreed to.
 *  lib/hospitality.ts is the fixed contract and its union predates that value,
 *  so the extra one lives here rather than in a shared type. */
type RowStatus = BookingStatus | 'declined';

/* The shared type scale stops at 14px for body text, which is under the floor
   for anything an owner reads off a screen. Body sits on the 18px step here,
   supporting lines on 15px. 13px is caps headings only. */
const FS_BODY = 'var(--fs-h3)';    /* 18px */
const FS_SMALL = '0.9375rem';      /* 15px */
const FS_CAPS = 'var(--fs-data)';  /* 13px */

const STATUS_META: Record<RowStatus, { label: string; colour: string }> = {
  pending:   { label: 'Waiting on you', colour: 'var(--warn)'   },
  confirmed: { label: 'Confirmed',      colour: 'var(--good)'   },
  completed: { label: 'Stayed',         colour: 'var(--text-3)' },
  declined:  { label: 'Turned down',    colour: 'var(--text-4)' },
  cancelled: { label: 'Called off',     colour: 'var(--text-4)' },
  no_show:   { label: 'Never arrived',  colour: 'var(--crit)'   },
};
const statusMeta = (s: string) => STATUS_META[s as RowStatus] ?? { label: s, colour: 'var(--text-3)' };

/** Lifetime value counts an agreed stay and a finished one. A request that was
 *  turned down, called off or never walked in earned nothing. Counting it
 *  would flatter the number an owner prices off. */
const COUNTS_TOWARD_VALUE = (b: Booking) => b.status === 'confirmed' || b.status === 'completed';

const ID_TYPE_LABEL: Record<string, string> = {
  passport: 'Passport',
  national_id: 'National ID',
  other: 'ID document',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 14px', minHeight: 40, borderRadius: 10, background: 'transparent',
  border: '1px solid var(--border-md)', color: 'var(--text-2)',
  fontSize: FS_SMALL, fontWeight: 600, cursor: 'pointer',
};
const capsLabel: React.CSSProperties = {
  fontSize: FS_CAPS, fontWeight: 700, color: 'var(--text-4)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

function fmtDay(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], thisYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

function Badge({ text, colour }: { text: string; colour: string }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 6, fontSize: FS_SMALL, fontWeight: 700, whiteSpace: 'nowrap',
      color: colour,
      background: `color-mix(in srgb, ${colour} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colour} 40%, transparent)`,
    }}>{text}</span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 140 }}>
      <div style={capsLabel}>{label}</div>
      <div style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-1)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

const COLUMNS = 'minmax(150px, 1.2fr) minmax(120px, 1fr) minmax(90px, 0.6fr) minmax(110px, 0.8fr) minmax(140px, 0.9fr)';

export default function GuestProfilePage() {
  const params = useParams<{ id: string }>();
  const guestId = params?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guest, setGuest] = useState<Guest | null>(null);
  const [stays, setStays] = useState<Booking[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [revealed, setRevealed] = useState('');

  // Unsealing a passport or NRC number is the owner's call. Staff run the
  // stay and see the masked tail; the server refuses the rest, so offering
  // a button that always fails would only look broken.
  const { teamRole } = useProfile();
  const canReveal = teamRole === 'owner';

  const load = useCallback(async () => {
    if (!guestId) return;
    setLoading(true); setError('');
    try {
      const [g, bs, us] = await Promise.all([
        getGuest(guestId),
        listGuestBookings(guestId),
        listUnits(),
      ]);
      setGuest(g); setStays(bs); setUnits(us);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this guest.');
    } finally {
      setLoading(false);
    }
  }, [guestId]);

  useEffect(() => { load(); }, [load]);

  const unitName = useCallback(
    (id: string) => units.find(u => u.id === id)?.unit_name ?? 'Unit removed',
    [units],
  );

  /** Money is kept per currency rather than added into one pile: a unit priced
   *  in dollars and one priced in kwacha do not sum to anything real. */
  const lifetime = useMemo(() => {
    const kept = stays.filter(COUNTS_TOWARD_VALUE);
    const money = new Map<string, number>();
    let nightCount = 0;
    for (const b of kept) {
      nightCount += nights(b);
      const sym = bookingSymbol(b);
      money.set(sym, (money.get(sym) ?? 0) + (b.total_amount || 0));
    }
    return {
      stays: kept.length,
      nights: nightCount,
      money: [...money.entries()].map(([sym, total]) => fmt(total, false, sym)).join(' · '),
    };
  }, [stays]);

  const reveal = async () => {
    try {
      const g = await getGuest(guestId, true);
      setRevealed(g.id_document_number || 'Nothing on file');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reveal the ID.');
    }
  };

  const contact = guest
    ? [guest.phone, guest.email].filter(Boolean).join(' · ') || 'No contact on file'
    : '';

  return (
    <>
      <Link
        href="/dashboard/hospitality/guests"
        style={{ display: 'inline-block', marginBottom: 16, fontSize: FS_SMALL, fontWeight: 600, color: 'var(--text-3)', textDecoration: 'none' }}
      >
        <span aria-hidden="true">‹</span> All guests
      </Link>

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: FS_SMALL, lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      {loading && (
        <p style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-3)' }}>Loading…</p>
      )}

      {!loading && guest && (
        <>
          <SectionCard
            title={guest.full_name}
            subtitle={contact}
            action={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {guest.vip_flag && <Badge text="VIP" colour="var(--warn)" />}
                {guest.is_repeat_guest && <Badge text={`Repeat · ${guest.stay_count ?? 0} stays`} colour="var(--good)" />}
              </div>
            }
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginBottom: 24 }}>
              <Field label="Phone" value={guest.phone || 'Not on file'} />
              <Field label="Email" value={guest.email || 'Not on file'} />
              <Field label="Nationality" value={guest.nationality || 'Not recorded'} />
              <Field
                label="ID document"
                value={
                  guest.id_document_on_file ? (
                    revealed ? (
                      <span>
                        {ID_TYPE_LABEL[guest.id_document_type ?? 'other'] ?? 'ID document'}: {revealed}
                      </span>
                    ) : canReveal ? (
                      <button style={ghostBtn} onClick={reveal} title="Reveal sealed ID">
                        {guest.id_document_masked || 'ID on file'} · reveal
                      </button>
                    ) : (
                      <span
                        style={{ color: 'var(--text-2)' }}
                        title="Only the owner can reveal a sealed ID"
                      >
                        {guest.id_document_masked || 'ID on file'}
                      </span>
                    )
                  ) : (
                    <span style={{ color: 'var(--text-3)' }}>None on file</span>
                  )
                }
              />
            </div>

            <div>
              <div style={capsLabel}>Staff notes (private)</div>
              <p style={{ fontSize: FS_BODY, lineHeight: 1.6, color: guest.notes ? 'var(--text-2)' : 'var(--text-4)', marginTop: 4 }}>
                {guest.notes || 'Nothing written down yet.'}
              </p>
            </div>
          </SectionCard>

          {/* Lifetime value. The number that answers "can I give this one a
              better rate" without opening a spreadsheet. */}
          <div className="grid-kpi" style={{ margin: '18px 0' }}>
            <KPICard
              label="Stays"
              sublabel="lifetime"
              value={String(lifetime.stays)}
              sub="confirmed and finished stays"
              sparkColor="var(--info)"
            />
            <KPICard
              label="Nights"
              sublabel="lifetime"
              value={String(lifetime.nights)}
              sub="nights slept here"
              sparkColor="var(--good)"
            />
            <KPICard
              label="Money"
              sublabel="lifetime"
              value={lifetime.money || 'None yet'}
              sub="what these stays were worth"
              sparkColor="var(--warn)"
            />
          </div>

          <SectionCard
            title="Every stay"
            subtitle={stays.length === 1 ? '1 booking on record' : `${stays.length} bookings on record`}
          >
            {stays.length === 0 ? (
              <p style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-3)' }}>
                No bookings yet for this guest. Add one on the calendar and it will show here.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 720 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 12, padding: '0 12px 8px 14px', borderBottom: '1px solid var(--border)' }}>
                    <span style={capsLabel}>Stay</span>
                    <span style={capsLabel}>Unit</span>
                    <span style={capsLabel}>Nights</span>
                    <span style={{ ...capsLabel, textAlign: 'right' }}>Amount</span>
                    <span style={capsLabel}>Status</span>
                  </div>

                  {stays.map(b => {
                    const m = statusMeta(b.status);
                    const nightCount = nights(b);
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: 'grid', gridTemplateColumns: COLUMNS, gap: 12,
                          padding: '16px 12px', alignItems: 'center',
                          borderBottom: '1px solid var(--border)',
                          // 2px edge in the status colour: the shape of the
                          // history reads before any of the words do.
                          borderLeft: `2px solid ${m.colour}`,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-1)' }}>
                            {fmtDay(b.check_in)} <span style={{ color: 'var(--text-4)' }}>to</span> {fmtDay(b.check_out)}
                          </div>
                          <div style={{ fontSize: FS_SMALL, lineHeight: 1.6, color: 'var(--text-3)' }}>
                            {[b.reference ? `Ref ${b.reference}` : null, b.source ? SOURCE_LABEL[b.source] : null]
                              .filter(Boolean).join(' · ') || 'No reference'}
                          </div>
                        </div>
                        <div style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-2)', minWidth: 0 }}>
                          {unitName(b.unit_id)}
                        </div>
                        <div style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-2)' }}>
                          {nightCount}
                        </div>
                        {/* The booking's own symbol, never the first unit's. */}
                        <div style={{ fontSize: FS_BODY, lineHeight: 1.6, fontWeight: 700, color: 'var(--text-1)', textAlign: 'right' }}>
                          {fmt(b.total_amount || 0, false, bookingSymbol(b))}
                        </div>
                        <div style={{ fontSize: FS_SMALL, lineHeight: 1.6, fontWeight: 600, color: m.colour }}>
                          {m.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p style={{ fontSize: FS_SMALL, lineHeight: 1.6, color: 'var(--text-4)', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              Lifetime totals count confirmed and finished stays only. A request you turned down or a
              stay that was called off is left out, because neither one brought any money in.
            </p>
          </SectionCard>
        </>
      )}

      {!loading && !guest && !error && (
        <p style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-3)' }}>
          That guest is not on file any more.
        </p>
      )}
    </>
  );
}
