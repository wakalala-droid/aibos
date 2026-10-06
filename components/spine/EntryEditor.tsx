'use client';
/**
 * EntryEditor: fix a recorded entry in place (UI/UX audit 2026-10, A9 and C1).
 *
 * The server could always correct an entry (PATCH /events/{id}: it keeps the
 * edit history, rebuilds the books and teaches Business Memory the correction)
 * but no screen offered it, so a typo meant voiding and typing the sale again.
 * This is the screen side: the amount, who or what it was, the date and the
 * note, saved through correctEvent. Only changed fields are sent.
 */
import { useState } from 'react';
import { correctEvent, type BusinessEvent } from '@/lib/api';
import { notify } from '@/lib/toast';

// The "who or what" field an entry carries, in the order summarize() reads them.
const WHO_FIELDS: [string, string][] = [
  ['customer', 'Customer'], ['supplier', 'Supplier'], ['employee', 'Staff member'],
  ['category', 'What it was for'], ['asset_name', 'What you bought'], ['item', 'Item'], ['tax_type', 'Tax'],
];

/** The local calendar day of an ISO time (UTC would be yesterday before 02:00 in Lusaka). */
function localDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const label: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 };
const input: React.CSSProperties = {
  width: '100%', minHeight: 44, padding: '8px 12px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontSize: 'var(--fs-body)',
};

export default function EntryEditor({ ev, onDone, onCancel }: { ev: BusinessEvent; onDone: () => void; onCancel: () => void }) {
  const p = (ev.payload || {}) as Record<string, unknown>;
  const has = (k: string) => p[k] !== undefined && p[k] !== null && p[k] !== '';
  const whoField = WHO_FIELDS.find(([k]) => has(k))
    ?? (ev.event_type === 'Sale' ? WHO_FIELDS[0] : ev.event_type === 'Expense' ? WHO_FIELDS[3] : null);
  const hasAmount = p.amount !== undefined && p.amount !== null;

  const [amount, setAmount] = useState(hasAmount ? String(p.amount) : '');
  const [who, setWho] = useState(whoField ? String(p[whoField[0]] ?? '') : '');
  const [day, setDay] = useState(localDay(ev.occurred_at));
  const [note, setNote] = useState(String(p.note ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const payload: Record<string, unknown> = {};
    if (hasAmount && amount.trim() !== String(p.amount)) {
      const n = Number(amount.replace(/,/g, ''));
      if (!Number.isFinite(n) || n <= 0) { setError('The amount must be a number above zero.'); return; }
      payload.amount = n;
    }
    if (whoField && who.trim() !== String(p[whoField[0]] ?? '')) payload[whoField[0]] = who.trim();
    if (note.trim() !== String(p.note ?? '')) payload.note = note.trim();
    const dayChanged = day && day !== localDay(ev.occurred_at);
    if (!Object.keys(payload).length && !dayChanged) { onCancel(); return; }

    setBusy(true); setError(null);
    try {
      await correctEvent(ev.id, {
        ...(Object.keys(payload).length ? { payload } : {}),
        // Noon, not midnight UTC, so the day survives the trip in any timezone.
        ...(dayChanged ? { occurred_at: `${day}T12:00:00Z` } : {}),
      });
      notify('Fixed. Your books are updated.');
      onDone();
    } catch (e) {
      setError((e as Error).message || 'That could not be saved. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void save(); }}
      style={{ width: '100%', marginTop: 12, padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-badge)', display: 'grid', gap: 16 }}
    >
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
        {hasAmount && (
          <div>
            <label htmlFor={`fix-amount-${ev.id}`} style={label}>Amount</label>
            <input id={`fix-amount-${ev.id}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={input} />
          </div>
        )}
        {whoField && (
          <div>
            <label htmlFor={`fix-who-${ev.id}`} style={label}>{whoField[1]}</label>
            <input id={`fix-who-${ev.id}`} value={who} onChange={(e) => setWho(e.target.value)} style={input} />
          </div>
        )}
        <div>
          <label htmlFor={`fix-day-${ev.id}`} style={label}>Date</label>
          <input id={`fix-day-${ev.id}`} type="date" value={day} onChange={(e) => setDay(e.target.value)} style={input} />
        </div>
      </div>
      <div>
        <label htmlFor={`fix-note-${ev.id}`} style={label}>Note</label>
        <input id={`fix-note-${ev.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" style={input} />
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--red)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="submit" disabled={busy}
          style={{ padding: '0 18px', borderRadius: 999, border: 'none', background: 'var(--brand-fill)', color: 'var(--on-brand)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Saving…' : 'Save the fix'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}
          style={{ padding: '0 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-1)', fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
