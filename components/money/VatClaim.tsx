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
 * A supplier's Smart Invoice often comes after the purchase was recorded.
 * The owner scans it on that purchase's row here (the Record page's QR
 * scanner, then POST /books/vat/{id}/smart-invoice), types the VAT printed on
 * it when the QR code carries none (ZRA's own carries none), and the purchase
 * moves to VAT you can claim, recorded once.
 *
 * Added up on the server from every confirmed entry (GET /books/vat), to the
 * ngwee, and read again whenever the books change. A Smart Invoice recorded
 * twice is claimed once and listed so the second can be removed. A
 * supplier's credit note takes its VAT off the VAT claimed.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SectionCard } from '@/components/kit';
import PeriodChips from '@/components/ui/PeriodChips';
import QrScanner from '@/components/spine/QrScanner';
import { attachSmartInvoice, getVatClaim, ingestQr, type VatClaim, type VatEntry } from '@/lib/api';
import { typeLabel } from '@/components/spine/eventMeta';
import { periodRange, type PeriodKey } from '@/lib/period';
import { useProfile } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';

const SHOWN = 6;

type Kind = 'claim' | 'lost' | 'twice' | 'credit';

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function whoOf(r: VatEntry): string {
  const named = r.supplier || (r.tpin ? `TPIN ${r.tpin}` : typeLabel(r.event_type));
  return named.charAt(0).toUpperCase() + named.slice(1);
}

function Entries({ rows, sym, kind, below }: {
  rows: VatEntry[]; sym: string; kind: Kind;
  /** What goes under a row: adding its Smart Invoice, on the list of purchases without one. */
  below?: (r: VatEntry) => React.ReactNode;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOWN);
  return (
    <>
      {shown.map((r) => {
        const sub = kind === 'lost'
          ? [day(r.occurred_at), typeLabel(r.event_type), r.vat != null ? `VAT on it ${fmt(r.vat, false, sym)}` : null]
          : [day(r.occurred_at), r.invoice ? `Invoice ${r.invoice}` : null, `TPIN ${r.tpin}`];
        const figure = kind === 'lost' ? r.amount : kind === 'credit' && r.vat != null ? -r.vat : r.vat;
        const row = (
          <Link className="row-link" href={`/dashboard/timeline?ids=${encodeURIComponent(r.id)}`}>
            <span className="row-main">
              <span className="row-title">{whoOf(r)}</span>
              <span className="row-sub">{sub.filter(Boolean).join(' · ')}</span>
            </span>
            <span className="row-amount">
              {figure == null ? 'VAT not recorded' : fmt(figure, false, sym)}
            </span>
          </Link>
        );
        return below
          ? <div key={r.id} style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{row}{below(r)}</div>
          : <div key={r.id}>{row}</div>;
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

const note = { margin: '0 0 4px', fontSize: 'var(--fs-label)', color: 'var(--text-3)' } as const;

/** A Smart Invoice scanned for one purchase, waiting for its VAT and the owner's Save. */
interface Scanned { id: string; qr: string; tpin: string; invoice: string; qrVat: number | null }

export default function VatClaimCard({ sym }: { sym: string }) {
  // Its own period: VAT is filed month by month, whatever the page above shows.
  const [period, setPeriod] = useState<PeriodKey>('this-month');
  const version = useStore((s) => s.booksVersion);
  const currency = useStore((s) => s.twin?.currency) || 'ZMW';
  const { teamRole } = useProfile();
  const canAdd = teamRole === 'owner';
  const [view, setView] = useState<VatClaim | null>(null);
  const [reread, setReread] = useState(0);

  const [scanFor, setScanFor] = useState<VatEntry | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [vatText, setVatText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    if (version === 0) return;
    let alive = true;
    const range = periodRange(period);
    getVatClaim(range?.[0], range?.[1])
      .then((v) => { if (alive) setView(v); })
      .catch(() => { if (alive) setView(null); });
    return () => { alive = false; };
  }, [period, version, reread]);

  // Read the QR code as the Record page does, to know what it is and whether
  // it carries the VAT, before anything is saved.
  async function read(text: string) {
    const entry = scanFor;
    setScanFor(null);
    if (!entry || !text) return;
    setError(null); setSaid(null); setScanned(null); setBusy(entry.id);
    try {
      const p = (await ingestQr(text, currency)).payload ?? {};
      if (p.smart_invoice !== true || typeof p.supplier_tpin !== 'string') {
        setError({ id: entry.id, text: "That QR code is not a ZRA Smart Invoice. Scan the QR code printed on the supplier's Smart Invoice." });
        return;
      }
      const qrVat = typeof p.tax === 'number' ? p.tax : null;
      setScanned({ id: entry.id, qr: text, tpin: p.supplier_tpin,
        invoice: String(p.zra_signature ?? p.invoice_ref ?? ''), qrVat });
      setVatText(qrVat == null && entry.vat != null ? String(entry.vat) : '');
    } catch (e) {
      setError({ id: entry.id, text: e instanceof Error ? e.message : 'Could not read that QR code. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  const typed = vatText.trim() === '' ? NaN : Number(vatText.replace(/,/g, ''));
  const vatOk = Number.isFinite(typed) && typed >= 0;

  async function save(entry: VatEntry) {
    if (!scanned || scanned.id !== entry.id) return;
    if (scanned.qrVat == null && !vatOk) return;
    setBusy(entry.id); setError(null);
    try {
      await attachSmartInvoice(entry.id, scanned.qr, scanned.qrVat == null ? typed : undefined);
      setScanned(null); setVatText('');
      setSaid(`${whoOf(entry)}: Smart Invoice added. Its VAT is now VAT you can claim.`);
      setReread((n) => n + 1);
    } catch (e) {
      setError({ id: entry.id, text: e instanceof Error ? e.message : 'Could not save that. Try again in a moment.' });
    } finally {
      setBusy(null);
    }
  }

  function addSmartInvoice(r: VatEntry) {
    const mine = scanned?.id === r.id ? scanned : null;
    const wrong = error?.id === r.id ? error.text : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        {wrong && <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-label)', color: 'var(--red)' }}>{wrong}</p>}
        {!mine && (
          <div>
            <button type="button" className="pill pill-quiet" disabled={busy === r.id}
              onClick={() => { setError(null); setSaid(null); setScanFor(r); }}>
              {busy === r.id ? 'Reading the QR code…' : 'Add its Smart Invoice'}
            </button>
          </div>
        )}
        {mine && (
          <form
            onSubmit={(e) => { e.preventDefault(); void save(r); }}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8 }}
          >
            <p style={{ flexBasis: '100%', margin: 0, fontSize: 'var(--fs-data)', color: 'var(--text-2)', lineHeight: 1.5 }}>
              ZRA Smart Invoice{mine.invoice ? ` ${mine.invoice}` : ''} from TPIN {mine.tpin}.
              {mine.qrVat != null
                ? ` VAT on it ${fmt(mine.qrVat, false, sym)}, read from the QR code.`
                : ' Its QR code has no VAT on it: type the VAT printed on the invoice.'}
            </p>
            {mine.qrVat == null && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                VAT on the invoice ({sym})
                <input className="field" type="number" inputMode="decimal" min={0} step="0.01" required
                  value={vatText} onChange={(e) => setVatText(e.target.value)}
                  placeholder="from the invoice" style={{ width: 160 }} autoFocus />
              </label>
            )}
            <button type="submit" className="pill pill-primary"
              disabled={busy === r.id || (mine.qrVat == null && !vatOk)}>
              {busy === r.id ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="pill pill-quiet" disabled={busy === r.id}
              onClick={() => { setScanned(null); setVatText(''); setError(null); }}>
              Cancel
            </button>
          </form>
        )}
      </div>
    );
  }

  // Nothing ever bought: no card.
  if (!view || !view.ever) return null;
  const { claim, lost, twice } = view;
  const credits = view.credits ?? { vat: 0, count: 0, no_vat_figure: 0, entries: [] };
  const nothing = claim.count === 0 && lost.count === 0 && twice.count === 0 && credits.count === 0;
  const notes = (n: number) => `${n} credit ${n === 1 ? 'note' : 'notes'}`;

  return (
    <SectionCard
      title="VAT you can claim"
      subtitle="Input VAT is claimed only against a ZRA Smart Invoice. Scan its QR code when you record a purchase, or add it here to a purchase already recorded. Claiming needs your business registered for VAT."
      style={{ marginBottom: 20 }}
    >
      <div style={{ marginBottom: 16 }}>
        <PeriodChips value={period} onChange={(p) => { setPeriod(p); setScanned(null); setError(null); setSaid(null); }}
          label="Which period" />
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
              {credits.count > 0 && `, less ${fmt(credits.vat, false, sym)} on ${notes(credits.count)}`}
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

      {said && (
        <p role="status" style={{ margin: '16px 0 0', fontSize: 'var(--fs-body)', color: 'var(--green)' }}>{said}</p>
      )}

      {claim.count > 0 && (
        <>
          <Heading>VAT you can claim</Heading>
          {claim.no_vat_figure > 0 && (
            <p style={note}>
              {claim.no_vat_figure === 1 ? 'One Smart Invoice has' : `${claim.no_vat_figure} Smart Invoices have`} no VAT recorded:
              open it and add the VAT printed on the invoice.
            </p>
          )}
          <Entries rows={claim.entries} sym={sym} kind="claim" />
        </>
      )}

      {credits.count > 0 && (
        <>
          <Heading>Credit notes from suppliers</Heading>
          <p style={note}>
            Money a supplier gave back with a credit note on ZRA&apos;s system. Its VAT comes off the VAT you claim.
            {credits.no_vat_figure > 0 && ` ${credits.no_vat_figure === 1 ? 'One has' : `${credits.no_vat_figure} have`} no VAT recorded: open it and add the VAT printed on the credit note.`}
          </p>
          <Entries rows={credits.entries} sym={sym} kind="credit" />
        </>
      )}

      {lost.count > 0 && (
        <>
          <Heading>VAT you can&apos;t claim: no Smart Invoice</Heading>
          <p style={note}>
            {canAdd
              ? 'When a seller is registered for VAT, ask for a Smart Invoice. One that came after you recorded the purchase goes on the purchase here: scan its QR code and its VAT moves to VAT you can claim.'
              : 'When a seller is registered for VAT, ask for a Smart Invoice. The owner can add one that came after the purchase was recorded.'}
          </p>
          <Entries rows={lost.entries} sym={sym} kind="lost" below={canAdd ? addSmartInvoice : undefined} />
        </>
      )}

      {twice.count > 0 && (
        <>
          <Heading>Recorded twice</Heading>
          <p style={note}>
            {twice.count === 1 ? 'This Smart Invoice is' : 'These Smart Invoices are'} already in your books,
            so {twice.count === 1 ? 'its' : 'their'} VAT is counted once. Remove the extra {twice.count === 1 ? 'entry' : 'entries'}.
          </p>
          <Entries rows={twice.entries} sym={sym} kind="twice" />
        </>
      )}

      {scanFor && (
        <QrScanner title="Scan the Smart Invoice" hint="Point at the QR code on the supplier's Smart Invoice"
          onResult={(text) => void read(text)} onClose={() => setScanFor(null)} />
      )}
    </SectionCard>
  );
}
