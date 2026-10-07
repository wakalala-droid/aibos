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
import { Mail, Phone } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import { Chip, DayBadge, Fact, Facts, Note, Section, toneOf } from '@/components/hospitality/kit';
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
const FS_BODY = 'var(--fs-body)';  /* 18px */
const FS_SMALL = 'var(--fs-label)'; /* 18px: nothing in a sentence is smaller */
const FS_CAPS = 'var(--fs-label)'; /* 18px */

const STATUS_LABEL: Record<RowStatus, string> = {
  pending:   'Waiting on you',
  confirmed: 'Confirmed',
  completed: 'Stayed',
  declined:  'Turned down',
  cancelled: 'Called off',
  no_show:   'Never arrived',
};
const statusLabel = (s: string) => STATUS_LABEL[s as RowStatus] ?? s;

/** Lifetime value counts an agreed stay and a finished one. A request that was
 *  turned down, called off or never walked in earned nothing. Counting it
 *  would flatter the number an owner prices off. */
const COUNTS_TOWARD_VALUE = (b: Booking) => b.status === 'confirmed' || b.status === 'completed';

const ID_TYPE_LABEL: Record<string, string> = {
  passport: 'Passport',
  national_id: 'National ID',
  other: 'ID document',
};


function fmtDay(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], thisYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const COLUMNS = 'minmax(230px, 1.4fr) minmax(120px, 1fr) minmax(90px, 0.6fr) minmax(110px, 0.8fr) minmax(140px, 0.9fr)';

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

      {error && <div style={{ marginBottom: 16 }}><Note tone="bad">{error}</Note></div>}

      {loading && (
        <p style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-3)' }}>Loading…</p>
      )}

      {!loading && guest && (
        <>
          {/* The guest, drawn like a stay on the calendar: a navy block. */}
          <SectionCard>
            <header className="rs-hero is-stay">
              <div className="rs-hero-top">
                <div className="rs-person">
                  <span className="rs-avatar" aria-hidden="true">{initials(guest.full_name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <h2 className="rs-hero-name" style={{ marginTop: 0 }}>{guest.full_name}</h2>
                    {guest.nationality && <div className="rs-hero-org">{guest.nationality}</div>}
                  </div>
                </div>
                {(guest.vip_flag || guest.is_repeat_guest) && (
                  <div className="rs-hero-chips">
                    {guest.vip_flag && <Chip>VIP</Chip>}
                    {guest.is_repeat_guest && <Chip>Repeat · {guest.stay_count ?? 0} stays</Chip>}
                  </div>
                )}
              </div>
              <div className="rs-hero-links">
                {guest.phone && (
                  <a className="rs-hero-link" href={`tel:${guest.phone.replace(/[^\d+]/g, '')}`}>
                    <Phone aria-hidden="true" /> Call {guest.phone}
                  </a>
                )}
                {guest.email && (
                  <a className="rs-hero-link" href={`mailto:${guest.email}`}>
                    <Mail aria-hidden="true" /> {guest.email}
                  </a>
                )}
                {!guest.phone && !guest.email && <span className="rs-hero-quiet">{contact}</span>}
              </div>
            </header>

            <Section title="Details">
              <Facts>
                <Fact label="Phone" value={guest.phone || 'Not on file'} />
                <Fact label="Email" value={guest.email || 'Not on file'} />
                <Fact label="Nationality" value={guest.nationality || 'Not recorded'} />
                <Fact
                  label="ID document"
                  value={
                    guest.id_document_on_file ? (
                      revealed ? (
                        <span>
                          {ID_TYPE_LABEL[guest.id_document_type ?? 'other'] ?? 'ID document'}: {revealed}
                        </span>
                      ) : canReveal ? (
                        <button type="button" className="rs-btn is-quiet is-sm" onClick={reveal} title="Reveal sealed ID">
                          {guest.id_document_masked || 'ID on file'} · reveal
                        </button>
                      ) : (
                        <span title="Only the owner can reveal a sealed ID">
                          {guest.id_document_masked || 'ID on file'}
                        </span>
                      )
                    ) : (
                      'None on file'
                    )
                  }
                />
              </Facts>
            </Section>

            <Section title="Staff notes (private)">
              <p className="rs-quote is-plain" style={{ color: guest.notes ? undefined : 'var(--text-4)' }}>
                {guest.notes || 'Nothing written down yet.'}
              </p>
            </Section>
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
                <div style={{ minWidth: 800 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 12, padding: '0 12px 8px 14px', borderBottom: '1px solid var(--border)' }}>
                    <span className="quiet-label">Stay</span>
                    <span className="quiet-label">Unit</span>
                    <span className="quiet-label">Nights</span>
                    <span className="quiet-label" style={{ textAlign: 'right' }}>Amount</span>
                    <span className="quiet-label">Status</span>
                  </div>

                  {stays.map(b => {
                    const nightCount = nights(b);
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: 'grid', gridTemplateColumns: COLUMNS, gap: 12,
                          padding: '16px 12px', alignItems: 'center',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {/* The arrival day as the calendar draws it: the shape
                            of the history reads before any of the words do. */}
                        <div className="rs-person">
                          <DayBadge date={b.check_in} tone={toneOf(b.status)} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: FS_BODY, lineHeight: 1.6, color: 'var(--text-1)' }}>
                              {fmtDay(b.check_in)} <span style={{ color: 'var(--text-4)' }}>to</span> {fmtDay(b.check_out)}
                            </div>
                            <div style={{ fontSize: FS_SMALL, lineHeight: 1.6, color: 'var(--text-3)' }}>
                              {[b.reference ? `Ref ${b.reference}` : null, b.source ? SOURCE_LABEL[b.source] : null]
                                .filter(Boolean).join(' · ') || 'No reference'}
                            </div>
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
                        <div>
                          <Chip tone={toneOf(b.status)}>{statusLabel(b.status)}</Chip>
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
