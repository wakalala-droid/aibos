'use client';
/**
 * VAT you can claim, on the Money page (29 Oct 2026).
 *
 * Since 1 January 2025 input VAT in Zambia is claimed only against a ZRA
 * Smart Invoice. This card splits what the business bought in a period into
 * the VAT it can claim (purchases recorded from a Smart Invoice, by scanning
 * its QR code or a photo of it) and what it bought without one, biggest
 * first, so the owner knows which suppliers to ask for a Smart Invoice.
 *
 * Added up on the server from every confirmed entry (GET /books/vat), to the
 * ngwee, and read again whenever the books change. A Smart Invoice recorded
 * twice is claimed once and listed so the second can be removed.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SectionCard } from '@/components/kit';
import PeriodChips from '@/components/ui/PeriodChips';
import { getVatClaim, type VatClaim, type VatEntry } from '@/lib/api';
import { typeLabel } from '@/components/spine/eventMeta';
import { periodRange, type PeriodKey } from '@/lib/period';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';

const SHOWN = 6;

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Entries({ rows, sym, kind }: { rows: VatEntry[]; sym: string; kind: 'claim' | 'lost' | 'twice' }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOWN);
  return (
    <>
      {shown.map((r) => {
        const named = r.supplier || (r.tpin ? `TPIN ${r.tpin}` : typeLabel(r.event_type));
        const who = named.charAt(0).toUpperCase() + named.slice(1);
        const sub = kind === 'lost'
          ? [day(r.occurred_at), typeLabel(r.event_type), r.vat != null ? `VAT on it ${fmt(r.vat, false, sym)}` : null]
          : [day(r.occurred_at), r.invoice ? `Invoice ${r.invoice}` : null, `TPIN ${r.tpin}`];
        const figure = kind === 'lost' ? r.amount : r.vat;
        return (
          <Link key={r.id} className="row-link" href={`/dashboard/timeline?ids=${encodeURIComponent(r.id)}`}>
            <span className="row-main">
              <span className="row-title">{who}</span>
              <span className="row-sub">{sub.filter(Boolean).join(' · ')}</span>
            </span>
            <span className="row-amount">
              {figure == null ? 'VAT not recorded' : fmt(figure, false, sym)}
            </span>
          </Link>
        );
      })}
      {rows.length > SHOWN && (
        <button type="button" className="pill pill-quiet" style={{ marginTop: 8 }} onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ margin: '20px 0 4px', fontSize: 'var(--fs-caps)', fontWeight: 600, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--text-3)' }}>
      {children}
    </h3>
  );
}

export default function VatClaimCard({ sym }: { sym: string }) {
  // Its own period: VAT is filed month by month, whatever the page above shows.
  const [period, setPeriod] = useState<PeriodKey>('this-month');
  const version = useStore((s) => s.booksVersion);
  const [view, setView] = useState<VatClaim | null>(null);

  useEffect(() => {
    if (version === 0) return;
    let alive = true;
    const range = periodRange(period);
    getVatClaim(range?.[0], range?.[1])
      .then((v) => { if (alive) setView(v); })
      .catch(() => { if (alive) setView(null); });
    return () => { alive = false; };
  }, [period, version]);

  // Nothing ever bought: no card.
  if (!view || !view.ever) return null;
  const { claim, lost, twice } = view;
  const nothing = claim.count === 0 && lost.count === 0 && twice.count === 0;

  return (
    <SectionCard
      title="VAT you can claim"
      subtitle="Input VAT is claimed only against a ZRA Smart Invoice. Scan its QR code when you record a purchase. Claiming needs your business registered for VAT."
      style={{ marginBottom: 20 }}
    >
      <div style={{ marginBottom: 16 }}>
        <PeriodChips value={period} onChange={setPeriod} label="Which period" />
      </div>

      {nothing && (
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>
          Nothing was bought in this period.
        </p>
      )}

      {!nothing && (
        <div className="mini-stats">
          <div className="mini-stat">
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>VAT you can claim</span>
            <span className="money money-md">{fmt(claim.vat, false, sym)}</span>
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
              {claim.count} Smart {claim.count === 1 ? 'Invoice' : 'Invoices'}
            </span>
          </div>
          <div className="mini-stat">
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Bought with no Smart Invoice</span>
            <span className="money money-md">{fmt(lost.spent, false, sym)}</span>
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
              {lost.count} {lost.count === 1 ? 'purchase' : 'purchases'}
              {lost.vat_shown > 0 && `, ${fmt(lost.vat_shown, false, sym)} VAT on them you can't claim`}
            </span>
          </div>
        </div>
      )}

      {claim.count > 0 && (
        <>
          <Heading>VAT you can claim</Heading>
          {claim.no_vat_figure > 0 && (
            <p style={{ margin: '0 0 4px', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
              {claim.no_vat_figure === 1 ? 'One Smart Invoice has' : `${claim.no_vat_figure} Smart Invoices have`} no VAT recorded:
              open it and add the VAT printed on the invoice.
            </p>
          )}
          <Entries rows={claim.entries} sym={sym} kind="claim" />
        </>
      )}

      {lost.count > 0 && (
        <>
          <Heading>VAT you can&apos;t claim: no Smart Invoice</Heading>
          <p style={{ margin: '0 0 4px', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            When a seller is registered for VAT, ask for a Smart Invoice next time and scan its QR code as you record the purchase.
          </p>
          <Entries rows={lost.entries} sym={sym} kind="lost" />
        </>
      )}

      {twice.count > 0 && (
        <>
          <Heading>Recorded twice</Heading>
          <p style={{ margin: '0 0 4px', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            {twice.count === 1 ? 'This Smart Invoice is' : 'These Smart Invoices are'} already in your books,
            so {twice.count === 1 ? 'its' : 'their'} VAT is counted once. Remove the extra {twice.count === 1 ? 'entry' : 'entries'}.
          </p>
          <Entries rows={twice.entries} sym={sym} kind="twice" />
        </>
      )}
    </SectionCard>
  );
}
