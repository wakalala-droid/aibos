'use client';
/**
 * AI-BOS — Record Business Activity (Evolution Initiative 1).
 * The single conversational entry point: the user says what happened in plain
 * language, AI proposes a structured Business Event, the user reviews/edits, then
 * confirms. Nothing is saved until confirmation (SAFEGUARD §0.4). Manual entry
 * (pick the type directly) is always available — AI is an accelerant, not a gate.
 *
 * Design OS: Inter/JetBrains-Mono via tokens, spacing scale, radius 6/10, 44px tap
 * targets, semantic colors, every state (idle/loading/proposal/saving/success/error).
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import {
  classifyActivity, createEvent, listEvents, ingestQr, ingestReceipt,
  type EventType, type EventProposal, type EventSource,
} from '@/lib/api';
import QrScanner from './QrScanner';

const TYPES: EventType[] = [
  'Sale', 'Purchase', 'Expense', 'InventoryReceipt', 'InventoryAdjustment',
  'Salary', 'SupplierPayment', 'CustomerPayment', 'AssetPurchase',
  'TaxPayment', 'Loan', 'Refund', 'Transfer',
];

type Field = { key: string; label: string; kind: 'number' | 'text' | 'select'; options?: string[]; placeholder?: string };

// Which payload fields each type surfaces for review (RFC-001 §5). `amount` is
// rendered separately (every money type needs it).
const TYPE_FIELDS: Record<EventType, Field[]> = {
  Sale:                [{ key: 'customer', label: 'Customer', kind: 'text' }, { key: 'payment_method', label: 'Paid by', kind: 'select', options: ['cash', 'mobile_money', 'card', 'bank', 'credit'] }],
  Purchase:            [{ key: 'supplier', label: 'Supplier', kind: 'text' }, { key: 'category', label: 'Category', kind: 'text' }, { key: 'payment_method', label: 'Paid by', kind: 'select', options: ['cash', 'mobile_money', 'card', 'bank', 'credit'] }],
  Expense:             [{ key: 'category', label: 'Category', kind: 'text', placeholder: 'rent, fuel, utilities…' }, { key: 'payment_method', label: 'Paid by', kind: 'select', options: ['cash', 'mobile_money', 'card', 'bank'] }, { key: 'is_fixed', label: 'Fixed cost?', kind: 'select', options: ['no', 'yes'] }],
  InventoryReceipt:    [{ key: 'supplier', label: 'Supplier', kind: 'text' }, { key: 'note', label: 'Items received', kind: 'text', placeholder: 'e.g. 2 crates soft drinks' }],
  InventoryAdjustment: [{ key: 'item', label: 'Item', kind: 'text' }, { key: 'delta_qty', label: 'Qty change (+/-)', kind: 'number' }, { key: 'reason', label: 'Reason', kind: 'select', options: ['recount', 'shrinkage', 'damage'] }],
  Salary:              [{ key: 'employee', label: 'Employee', kind: 'text' }, { key: 'period', label: 'Period', kind: 'text', placeholder: 'e.g. June 2026' }],
  SupplierPayment:     [{ key: 'supplier', label: 'Supplier', kind: 'text' }, { key: 'invoice_ref', label: 'Invoice ref', kind: 'text' }],
  CustomerPayment:     [{ key: 'customer', label: 'Customer', kind: 'text' }, { key: 'invoice_ref', label: 'Invoice ref', kind: 'text' }],
  AssetPurchase:       [{ key: 'asset_name', label: 'Asset', kind: 'text' }, { key: 'category', label: 'Category', kind: 'text' }],
  TaxPayment:          [{ key: 'tax_type', label: 'Tax type', kind: 'text', placeholder: 'VAT, PAYE…' }, { key: 'authority', label: 'Authority', kind: 'text', placeholder: 'ZRA' }],
  Loan:                [{ key: 'direction', label: 'Direction', kind: 'select', options: ['received', 'repayment'] }, { key: 'lender', label: 'Lender', kind: 'text' }],
  Refund:              [{ key: 'direction', label: 'Direction', kind: 'select', options: ['to_customer', 'from_supplier'] }, { key: 'reason', label: 'Reason', kind: 'text' }],
  Transfer:            [{ key: 'from', label: 'From', kind: 'text', placeholder: 'cash' }, { key: 'to', label: 'To', kind: 'text', placeholder: 'bank' }],
};

const NO_AMOUNT: EventType[] = ['InventoryReceipt', 'InventoryAdjustment']; // amount optional

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', minHeight: 44,
  background: 'var(--bg-input)', border: '1px solid var(--border-md)',
  borderRadius: 6, color: 'var(--text-1)', fontFamily: 'Inter, sans-serif',
  fontSize: '0.875rem', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', fontWeight: 600,
  color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: 6, display: 'block',
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

// Minimal typing for the Web Speech API (not in lib.dom for all targets).
type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
};
function getSpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function RecordActivity({ onSaved }: { onSaved?: () => void }) {
  const currencySymbol = useStore(s => s.currencySymbol) || 'K';
  const refreshTwin = useStore(s => s.refreshTwin);
  const setRecentEvents = useStore(s => s.setRecentEvents);

  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'idle' | 'classifying' | 'review' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Review-form state.
  const [etype, setEtype] = useState<EventType>('Sale');
  const [amount, setAmount] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [occurred, setOccurred] = useState(todayISO());
  const [confidence, setConfidence] = useState<number | null>(null);
  const [reasoning, setReasoning] = useState('');
  // Provenance: which input produced the event being reviewed. Saved on confirm so
  // the Timeline shows the true source (voice/qr/receipt), not "manual".
  const [origin, setOrigin] = useState<EventSource>('manual');
  const fileRef = useRef<HTMLInputElement>(null);

  // Voice capture (Web Speech API) — Initiative 2. Progressive enhancement: the
  // mic only appears where the browser supports it; typing always works.
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  useEffect(() => { setVoiceSupported(getSpeechCtor() != null); }, []);

  // QR scan (Initiative 7) — decode a receipt QR, parse it server-side into a proposal.
  const [scanning, setScanning] = useState(false);
  async function handleScanResult(qrText: string) {
    setScanning(false);
    if (!qrText) return;
    setOrigin('qr');
    setError(null); setSuccess(null); setPhase('classifying');
    try {
      const proposal = await ingestQr(qrText, 'ZMW');
      if (!proposal.event_type && !proposal.payload?.amount) {
        setError("Couldn't read that QR — try the photo/manual entry."); setPhase('idle'); return;
      }
      loadProposal(proposal);
    } catch (e) {
      setError((e as Error).message || 'Could not read that QR.'); setPhase('idle');
    }
  }

  async function handleReceipt(file: File) {
    if (fileRef.current) fileRef.current.value = '';  // allow re-picking the same file
    setOrigin('receipt');
    setError(null); setSuccess(null); setPhase('classifying');
    try {
      const proposal = await ingestReceipt(file, 'ZMW');
      if (!proposal.payload?.amount) {
        setError("Couldn't read a total from that photo — try a clearer shot or enter it manually.");
        setPhase('idle'); return;
      }
      loadProposal(proposal);
    } catch (e) {
      setError((e as Error).message || 'Could not read that receipt.'); setPhase('idle');
    }
  }

  function loadProposal(p: EventProposal) {
    const t = (p.event_type && TYPES.includes(p.event_type)) ? p.event_type : 'Expense';
    setEtype(t);
    const pl = p.payload || {};
    setAmount(pl.amount != null ? String(pl.amount) : '');
    const f: Record<string, string> = {};
    for (const fld of TYPE_FIELDS[t]) {
      const v = pl[fld.key];
      if (v != null) f[fld.key] = String(v);
    }
    setFields(f);
    setConfidence(typeof p.confidence === 'number' ? p.confidence : null);
    setReasoning(p.reasoning || '');
    setPhase('review');
  }

  async function handleClassify(override?: string, src: EventSource = 'manual') {
    const t = (override ?? text).trim();
    if (!t) { setError('Describe what happened first.'); return; }
    setOrigin(src);
    setError(null); setSuccess(null); setPhase('classifying');
    try {
      const proposal = await classifyActivity(t);
      loadProposal(proposal);
    } catch (e) {
      setError((e as Error).message || 'Could not interpret that.');
      setPhase('idle');
    }
  }

  function toggleVoice() {
    if (listening) { recRef.current?.stop(); return; }
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-US'; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? '';
      if (transcript) { setText(transcript); handleClassify(transcript, 'voice'); }
    };
    rec.onerror = () => { setListening(false); setError('Could not hear that — try again or type it.'); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null); setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }

  function startManual() {
    setError(null); setSuccess(null); setOrigin('manual');
    setEtype('Sale'); setAmount(''); setFields({}); setOccurred(todayISO());
    setConfidence(null); setReasoning('');
    setPhase('review');
  }

  function changeType(t: EventType) {
    setEtype(t);
    // Drop fields that don't belong to the new type.
    setFields(prev => {
      const keep: Record<string, string> = {};
      for (const fld of TYPE_FIELDS[t]) if (prev[fld.key]) keep[fld.key] = prev[fld.key];
      return keep;
    });
  }

  async function handleSave() {
    setError(null);
    const needsAmount = !NO_AMOUNT.includes(etype);
    const amt = parseFloat(amount);
    if (needsAmount && (!amount || isNaN(amt) || amt <= 0)) {
      setError('Enter a valid amount.');
      return;
    }
    const payload: Record<string, unknown> = {};
    if (needsAmount || amount) payload.amount = Math.abs(amt || 0);
    for (const [k, v] of Object.entries(fields)) {
      if (v === '' || v == null) continue;
      const fld = TYPE_FIELDS[etype].find(f => f.key === k);
      payload[k] = fld?.kind === 'number' ? Number(v) : (k === 'is_fixed' ? v === 'yes' : v);
    }
    setPhase('saving');
    try {
      await createEvent({
        event_type: etype,
        payload,
        source: origin,            // true provenance (manual | voice | qr | receipt)
        confidence: 1.0,           // human-reviewed in this form → save as confirmed
        occurred_at: occurred !== todayISO() ? occurred : undefined,
      });
      setSuccess(`${etype} recorded.`);
      setText(''); setAmount(''); setFields({}); setPhase('idle');
      // Refresh the twin (lights up dashboards) and recent events.
      refreshTwin();
      listEvents({ limit: 8 }).then(setRecentEvents).catch(() => {});
      onSaved?.();
    } catch (e) {
      setError((e as Error).message || 'Could not save.');
      setPhase('review');
    }
  }

  const busy = phase === 'classifying' || phase === 'saving';

  return (
    <div>
      {/* ── Conversational input ─────────────────────────────────────────────── */}
      <label htmlFor="record-input" style={labelStyle}>What happened?</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          id="record-input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !busy) handleClassify(); }}
          placeholder={`e.g. I sold 15 drinks for ${currencySymbol}150`}
          disabled={busy}
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            disabled={busy}
            aria-label={listening ? 'Stop voice input' : 'Speak instead of typing'}
            className="touch-target"
            style={{
              width: 44, minHeight: 44, borderRadius: 10, cursor: busy ? 'default' : 'pointer',
              border: `1px solid ${listening ? 'var(--red)' : 'var(--border-md)'}`,
              background: listening ? 'var(--red-dim)' : 'var(--bg-input)',
              color: listening ? 'var(--red)' : 'var(--text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => setScanning(true)}
          disabled={busy}
          aria-label="Scan a receipt QR code"
          className="touch-target"
          style={{
            width: 44, minHeight: 44, borderRadius: 10, cursor: busy ? 'default' : 'pointer',
            border: '1px solid var(--border-md)', background: 'var(--bg-input)',
            color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <rect x="8" y="8" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleReceipt(f); }}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Photograph or upload a receipt"
          className="touch-target"
          style={{
            width: 44, minHeight: 44, borderRadius: 10, cursor: busy ? 'default' : 'pointer',
            border: '1px solid var(--border-md)', background: 'var(--bg-input)',
            color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 8a2 2 0 012-2h1.5l1-1.5h5l1 1.5H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleClassify()}
          disabled={busy}
          className="touch-target"
          style={{
            padding: '10px 18px', minHeight: 44, borderRadius: 10, border: 'none',
            background: 'var(--cyan)', color: '#04121a', fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1, whiteSpace: 'nowrap',
          }}
        >
          {phase === 'classifying' ? 'Reading…' : 'Record'}
        </button>
      </div>
      <button
        type="button"
        onClick={startManual}
        disabled={busy}
        style={{
          marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.7rem', textDecoration: 'underline', padding: '4px 0',
        }}
      >
        or enter it manually
      </button>

      {/* ── Feedback ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--green-dim)', border: '1px solid var(--green)', color: 'var(--green)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Review / edit the proposed event ─────────────────────────────────── */}
      <AnimatePresence>
        {phase !== 'idle' && phase !== 'classifying' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)' }}>
                  Review &amp; confirm
                </span>
                {confidence != null && (
                  <span className="badge" style={{
                    background: confidence >= 0.7 ? 'var(--green-dim)' : 'var(--orange-dim)',
                    color: confidence >= 0.7 ? 'var(--green)' : 'var(--orange)',
                  }}>
                    {Math.round(confidence * 100)}% confident
                  </span>
                )}
              </div>

              {reasoning && (
                <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  {reasoning}
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {/* Type */}
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={etype} onChange={e => changeType(e.target.value as EventType)} style={inputStyle}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label style={labelStyle}>Amount ({currencySymbol})</label>
                  <input
                    type="number" inputMode="decimal" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>

                {/* Type-specific fields */}
                {TYPE_FIELDS[etype].map(fld => (
                  <div key={fld.key}>
                    <label style={labelStyle}>{fld.label}</label>
                    {fld.kind === 'select' ? (
                      <select
                        value={fields[fld.key] ?? ''}
                        onChange={e => setFields(p => ({ ...p, [fld.key]: e.target.value }))}
                        style={inputStyle}
                      >
                        <option value="">—</option>
                        {fld.options!.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={fld.kind === 'number' ? 'number' : 'text'}
                        value={fields[fld.key] ?? ''}
                        onChange={e => setFields(p => ({ ...p, [fld.key]: e.target.value }))}
                        placeholder={fld.placeholder}
                        style={fld.kind === 'number' ? { ...inputStyle, fontFamily: 'JetBrains Mono, monospace' } : inputStyle}
                      />
                    )}
                  </div>
                ))}

                {/* Date */}
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={occurred} max={todayISO()} onChange={e => setOccurred(e.target.value)}
                    style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button
                  type="button" onClick={handleSave} disabled={busy} className="touch-target"
                  style={{
                    padding: '10px 20px', minHeight: 44, borderRadius: 10, border: 'none',
                    background: 'var(--green)', color: '#04140d', fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
                  }}
                >
                  {phase === 'saving' ? 'Saving…' : 'Confirm & save'}
                </button>
                <button
                  type="button" onClick={() => { setPhase('idle'); setError(null); }} disabled={busy} className="touch-target"
                  style={{
                    padding: '10px 20px', minHeight: 44, borderRadius: 10,
                    border: '1px solid var(--border-md)', background: 'transparent',
                    color: 'var(--text-2)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {scanning && <QrScanner onResult={handleScanResult} onClose={() => setScanning(false)} />}
    </div>
  );
}
