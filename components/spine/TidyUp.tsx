'use client';
/**
 * Tidy up (upgrade 16): test entries and mistakes that no longer carry any
 * money, cleared in one place. Trying AIBOS out left clutter nothing could
 * remove: a K0 salary line, invoices sent and then undone, bookings called off
 * before any money moved, a payroll run whose wages were voided. None of it
 * changed a figure; all of it sat in the lists.
 *
 * The server decides what qualifies (cleanup.py) and re-checks when asked to
 * clear, so nothing that still carries money can go. Owner only: for anyone
 * else the server refuses and this card does not show.
 */
import { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { findTidyUp, applyTidyUp, type TidyFound, type TidyKind } from '@/lib/api';

const KIND: Record<TidyKind, { title: string; what: string }> = {
  zero_records:    { title: 'Records of K0',                          what: 'Voided, so they leave the lists. They never changed a figure.' },
  undone_invoices: { title: 'Invoices whose money was undone',         what: 'Removed. Their records stay voided in Activity.' },
  empty_bookings:  { title: 'Bookings called off with no money on them', what: 'Removed from the bookings list.' },
  undone_payroll:  { title: 'Payroll runs with no wage standing',      what: 'Removed, so that month can be run again.' },
};
const ORDER: TidyKind[] = ['zero_records', 'undone_invoices', 'empty_bookings', 'undone_payroll'];

export default function TidyUp({ onDone }: { onDone?: () => void }) {
  const [found, setFound] = useState<TidyFound | null>(null);
  const [hidden, setHidden] = useState(false);
  const [picked, setPicked] = useState<Set<TidyKind>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const f = await findTidyUp();
      setFound(f);
      // Nothing ticked to start: a cancelled booking can be history worth keeping.
    } catch {
      setHidden(true);          // staff, or the server is not up to date yet
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (hidden || !found) return null;
  const kinds = ORDER.filter((k) => found[k].length > 0);

  const toggle = (k: TidyKind) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const tidy = async () => {
    const chosen = kinds.filter((k) => picked.has(k));
    if (!chosen.length) return;
    const count = chosen.reduce((t, k) => t + found[k].length, 0);
    if (!window.confirm(`Tidy away ${count} entr${count === 1 ? 'y' : 'ies'}? None of them carries any money. This cannot be undone.`)) return;
    setBusy(true); setNote('');
    try {
      const done = await applyTidyUp(chosen);
      const total = Object.values(done).reduce((t, n) => t + (n || 0), 0);
      setNote(`Tidied away ${total} entr${total === 1 ? 'y' : 'ies'}.`);
      await load();
      onDone?.();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not tidy up.');
    } finally { setBusy(false); }
  };

  return (
    <SectionCard title="Tidy up" subtitle="Test entries and mistakes that no longer carry any money." style={{ marginTop: 20 }}>
      {kinds.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-3)' }}>
          Nothing to tidy. Every entry here still carries money.
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
            {kinds.map((k) => (
              <label key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(k)} onChange={() => toggle(k)} style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>
                    {KIND[k].title} ({found[k].length})
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '2px 0 6px' }}>{KIND[k].what}</span>
                  {found[k].slice(0, 6).map((i) => (
                    <span key={i.id} style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-2)', lineHeight: 1.6 }}>{i.label}</span>
                  ))}
                  {found[k].length > 6 && (
                    <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>and {found[k].length - 6} more</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <button type="button" onClick={() => void tidy()} disabled={busy || !kinds.some((k) => picked.has(k))}
            style={{ padding: '10px 18px', minHeight: 44, borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-badge)', color: 'var(--text-1)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Tidying…' : 'Tidy away the ticked ones'}
          </button>
        </>
      )}
      {note && <p role="status" style={{ margin: '12px 0 0', fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>{note}</p>}
    </SectionCard>
  );
}
