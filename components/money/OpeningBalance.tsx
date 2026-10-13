'use client';
/**
 * "What you hold today": the one figure AIBOS cannot work out for itself.
 *
 * The money figure is the opening balance plus everything recorded since.
 * AIBOS only knows the opening balance if the owner typed it during setup;
 * otherwise the books start from K0, and an owner who pays wages from money
 * that was already in the bank sees a figure below nothing. There was no way
 * to set it after setup. Here the owner says what they hold now, all together,
 * and the books start from whatever makes that true. Nothing recorded changes.
 */
import { useState } from 'react';
import { SectionCard } from '@/components/kit';
import { useStore } from '@/lib/store';
import { seedTwin } from '@/lib/api';

export default function OpeningBalance() {
  const twin = useStore((s) => s.twin);
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const [held, setHeld] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!twin) return null;

  const cash = Number(twin.cash) || 0;
  const opening = Number(twin.opening_cash) || 0;
  const recorded = Math.round((cash - opening) * 100) / 100;     // everything in and out since
  const money = (v: number) =>
    `${v < 0 ? '−' : ''}${sym}${Math.abs(v).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  async function save() {
    const value = Number(held);
    if (!held.trim() || !Number.isFinite(value)) { setError('Enter what you hold now, all together.'); return; }
    setBusy(true); setError(null); setNote(null);
    try {
      const start = Math.round((value - recorded) * 100) / 100;
      await seedTwin(start, twin?.currency || 'ZMW');
      await useStore.getState().refreshTwin();
      setNote(`Your money figure is now ${money(value)}. Nothing you recorded changed: your books now start from ${money(start)} instead of ${money(opening)}.`);
      setHeld('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="What you hold today"
      subtitle="Your money figure is what you started with plus everything recorded since."
      style={{ marginBottom: 20 }}
    >
      {cash < 0 && (
        <p role="status" style={{ margin: '0 0 12px', fontSize: 'var(--fs-body)', lineHeight: 1.55, color: 'var(--amber)' }}>
          Your books show {money(cash)}: more has been recorded going out than coming in. AIBOS counts only what
          is recorded, and your books start from {money(opening)} because it never knew what you had before. Tell
          it what you hold now and the figure will match.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="field-label" htmlFor="held-now">Cash, mobile money and bank together ({sym})</label>
          <input id="held-now" type="number" step="0.01" inputMode="decimal" value={held}
            onChange={(e) => setHeld(e.target.value)} placeholder={cash > 0 ? String(cash) : '0'} className="field" style={{ width: 'auto' }} />
        </div>
        <button type="button" onClick={() => void save()} disabled={busy} className="pill pill-primary">
          {busy ? 'Saving…' : 'Set it'}
        </button>
      </div>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 'var(--fs-body)', color: 'var(--red)' }}>{error}</p>}
      {note && <p role="status" style={{ margin: '8px 0 0', fontSize: 'var(--fs-body)', color: 'var(--green)' }}>{note}</p>}
    </SectionCard>
  );
}
