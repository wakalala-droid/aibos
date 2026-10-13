'use client';
/**
 * The books check on the Money page: every invoice, mobile money payment,
 * stay and payslip held against the books, to the ngwee (GET /books/check).
 *
 * It runs when the owner asks, and by itself when they arrive from the daily
 * check's notification (?check=1). Totals that fell behind their entries are
 * counted again by the server; everything else is listed with what to do,
 * never changed for the owner.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { SectionCard } from '@/components/kit';
import { checkBooks, type BooksCheck } from '@/lib/api';

export default function BooksCheckCard() {
  const params = useSearchParams();
  const [result, setResult] = useState<BooksCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true); setError(null);
    try { setResult(await checkBooks()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not check the books just now. Try again in a moment.'); }
    finally { setBusy(false); }
  }, []);

  // Arriving from the daily check's notification: show the answer at once.
  useEffect(() => { if (params?.get('check') === '1') void run(); }, [params, run]);

  const counts = result ? [
    ['Entries', result.checked.entries],
    ['Invoices', result.checked.invoices],
    ['Mobile money payments', result.checked.collections],
    ['Stays', result.checked.stays],
    ['Payslips', result.checked.payslips],
  ] as const : [];

  return (
    <SectionCard
      title="Books check"
      subtitle="Every invoice, payment, stay and payslip held against your books, to the ngwee."
      style={{ marginBottom: 20 }}
      action={
        <button type="button" onClick={() => void run()} disabled={busy} className="pill pill-quiet">
          <ShieldCheck aria-hidden="true" />{busy ? 'Checking…' : result ? 'Check again' : 'Check my books'}
        </button>
      }
    >
      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--red)' }}>{error}</p>
      )}
      {!result && !error && (
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-3)', lineHeight: 1.55 }}>
          AIBOS checks this every day by itself and tells you if anything disagrees. Check now to see it for yourself.
        </p>
      )}
      {result && (
        <div role="status">
          <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-body)', lineHeight: 1.55,
            color: result.ok ? 'var(--green)' : 'var(--amber)' }}>
            {result.summary}
          </p>
          <div className="mini-stats" style={{ marginBottom: result.problems.length ? 12 : 0 }}>
            {counts.map(([label, n]) => (
              <div key={label} className="mini-stat">
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{label}</span>
                <span className="money money-md">{n.toLocaleString('en-ZM')}</span>
              </div>
            ))}
          </div>
          {result.problems.map((p, i) => (
            <div key={`${p.kind}-${p.ref ?? i}`} className="row">
              <span className="row-main">
                <span className="row-title" style={{ whiteSpace: 'normal', fontWeight: p.money ? 600 : 500,
                  color: p.money ? 'var(--text-1)' : 'var(--text-2)' }}>{p.message}</span>
                {!p.money && <span className="row-sub">A note: no figure is missing.</span>}
              </span>
              {p.link && (
                <span className="row-actions">
                  <Link href={p.link} className="icon-pill" aria-label="Open where this is"><ArrowUpRight aria-hidden="true" /></Link>
                </span>
              )}
            </div>
          ))}
          {result.healed.map((h) => (
            <p key={h} style={{ margin: '8px 0 0', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{h}</p>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
