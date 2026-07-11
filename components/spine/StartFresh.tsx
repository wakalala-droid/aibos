'use client';
/**
 * AI-BOS — Start Fresh (Timeline danger zone).
 * Recovery path for "the wrong file was imported / everything mapped incorrectly":
 * permanently deletes recorded data (all events, or only file-imported ones) and
 * replays the twin from whatever remains. This is a HARD delete — single mistakes
 * should use per-event void instead — so it is gated behind a typed RESET.
 */
import { useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { useStore } from '@/lib/store';
import { resetTimeline } from '@/lib/api';

type Scope = 'all' | 'excel';

const label: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
  fontSize: 'var(--fs-data)', color: 'var(--text-2)',
};
const hint: React.CSSProperties = {
  fontSize: 'var(--fs-label)', color: 'var(--text-4)', marginTop: 2,
};

export default function StartFresh({ onDone }: { onDone?: () => void }) {
  const refreshTwin = useStore(s => s.refreshTwin);
  const clearBusinessData = useStore(s => s.clearBusinessData);

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>('all');
  const [wipeMemory, setWipeMemory] = useState(true);
  const [wipeProducts, setWipeProducts] = useState(false);
  const [wipeSchedule, setWipeSchedule] = useState(false);
  const [resetOpeningCash, setResetOpeningCash] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const armed = confirmText.trim().toUpperCase() === 'RESET';

  async function handleReset() {
    if (!armed || busy) return;
    setBusy(true); setError(null); setDone(null);
    try {
      const res = await resetTimeline({
        source: scope === 'excel' ? 'excel' : undefined,
        wipe_memory: wipeMemory,
        wipe_products: wipeProducts,
        wipe_schedule: wipeSchedule,
        reset_opening_cash: resetOpeningCash,
      });
      if (scope === 'all') clearBusinessData(); // clear derived data; tier/identity/prefs survive
      await refreshTwin();
      onDone?.();
      const extras = [
        res.deleted_memory > 0 && `${res.deleted_memory} learned mapping${res.deleted_memory === 1 ? '' : 's'}`,
        res.deleted_products > 0 && `${res.deleted_products} product${res.deleted_products === 1 ? '' : 's'}`,
        res.deleted_schedule > 0 && `${res.deleted_schedule} scheduled item${res.deleted_schedule === 1 ? '' : 's'}`,
      ].filter(Boolean).join(', ');
      setDone(
        `Deleted ${res.deleted_events} event${res.deleted_events === 1 ? '' : 's'}` +
        (extras ? ` (plus ${extras})` : '') + '. Your business is starting fresh.'
      );
      setOpen(false); setConfirmText('');
    } catch (e) {
      setError((e as Error).message || 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="Start fresh"
      subtitle="Danger zone — permanently delete recorded data and rebuild from zero."
      style={{ marginTop: 24 }}
      action={!open ? (
        <button type="button" className="touch-target" onClick={() => { setOpen(true); setDone(null); }}
          style={{ padding: '6px 12px', minHeight: 32, borderRadius: 6, border: '1px solid var(--red)', background: 'transparent', color: 'var(--red)', fontSize: 'var(--fs-label)', fontWeight: 600, cursor: 'pointer' }}>
          Start fresh…
        </button>
      ) : undefined}
    >
      {done && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid var(--green)', color: 'var(--green)', fontSize: 'var(--fs-data)' }}>
          {done}
        </div>
      )}

      {!open && !done && (
        <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', margin: 0 }}>
          Imported the wrong file, or mapped columns incorrectly? Flush the bad data and
          start again. For a single wrong entry, void it on the timeline instead.
        </p>
      )}

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* What to delete */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={label}>
              <input type="radio" name="reset-scope" checked={scope === 'all'} onChange={() => setScope('all')}
                style={{ accentColor: 'var(--red)', marginTop: 2 }} />
              <span>
                <strong style={{ color: 'var(--text-1)' }}>Everything</strong> — every recorded event, from every source
                <div style={hint}>The timeline, and every dashboard number derived from it, returns to zero.</div>
              </span>
            </label>
            <label style={label}>
              <input type="radio" name="reset-scope" checked={scope === 'excel'} onChange={() => setScope('excel')}
                style={{ accentColor: 'var(--red)', marginTop: 2 }} />
              <span>
                <strong style={{ color: 'var(--text-1)' }}>Only file imports</strong> — events created by Excel/CSV import
                <div style={hint}>Undo a bad upload. Activity you recorded by hand, voice, receipt or QR stays.</div>
              </span>
            </label>
          </div>

          {/* Extras */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <label style={label}>
              <input type="checkbox" checked={wipeMemory} onChange={e => setWipeMemory(e.target.checked)}
                style={{ accentColor: 'var(--red)', marginTop: 2 }} />
              <span>
                Forget learned import mappings &amp; name aliases
                <div style={hint}>Recommended after a wrong mapping — otherwise the next import re-applies it.</div>
              </span>
            </label>
            <label style={label}>
              <input type="checkbox" checked={wipeProducts} onChange={e => setWipeProducts(e.target.checked)}
                style={{ accentColor: 'var(--red)', marginTop: 2 }} />
              <span>Also delete the product catalog</span>
            </label>
            <label style={label}>
              <input type="checkbox" checked={wipeSchedule} onChange={e => setWipeSchedule(e.target.checked)}
                style={{ accentColor: 'var(--red)', marginTop: 2 }} />
              <span>Also delete scheduled items</span>
            </label>
            <label style={label}>
              <input type="checkbox" checked={resetOpeningCash} onChange={e => setResetOpeningCash(e.target.checked)}
                style={{ accentColor: 'var(--red)', marginTop: 2 }} />
              <span>
                Also reset opening cash to 0
                <div style={hint}>Leave unchecked to keep the opening balance you set during setup.</div>
              </span>
            </label>
          </div>

          {/* Typed confirmation */}
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--red)', margin: '0 0 8px' }}>
              This cannot be undone. Type <strong>RESET</strong> to confirm.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <input
                type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
                placeholder="RESET" autoComplete="off" spellCheck={false} aria-label="Type RESET to confirm"
                style={{ width: 120, padding: '8px 12px', borderRadius: 6, border: `1px solid ${armed ? 'var(--red)' : 'var(--border-md)'}`, background: 'transparent', color: 'var(--text-1)', fontSize: 'var(--fs-data)', fontWeight: 600, letterSpacing: '0.08em', outline: 'none' }}
              />
              <button type="button" className="touch-target" onClick={handleReset} disabled={!armed || busy}
                style={{ padding: '8px 16px', minHeight: 36, borderRadius: 6, border: '1px solid var(--red)', background: armed ? 'var(--red)' : 'var(--red-dim)', color: armed ? '#fff' : 'var(--red)', fontSize: 'var(--fs-data)', fontWeight: 700, cursor: armed && !busy ? 'pointer' : 'not-allowed', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Deleting…' : scope === 'all' ? 'Delete everything & start fresh' : 'Delete file imports'}
              </button>
              <button type="button" className="touch-target" onClick={() => { setOpen(false); setConfirmText(''); setError(null); }}
                style={{ padding: '8px 14px', minHeight: 36, borderRadius: 6, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-3)', fontSize: 'var(--fs-data)', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-data)' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
