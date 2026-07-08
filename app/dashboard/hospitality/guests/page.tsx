'use client';
/**
 * Guests — the CRM master record. Repeat/VIP recognition the OTAs can't give a
 * small host (they hide the guest behind the platform). ID document capture is
 * sealed at rest (Fernet, server-side) for the embassy/corporate segment — the raw
 * number is never listed; a masked tail shows, and "reveal" is an explicit action.
 */
import { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import {
  listGuests, createGuest, getGuest, type Guest,
} from '@/lib/hospitality';

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontFamily: 'Geist, sans-serif', fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};
const primaryBtn: React.CSSProperties = {
  padding: '9px 16px', minHeight: 38, borderRadius: 8, border: 'none', background: 'var(--cyan)',
  color: '#fff', fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '7px 12px', minHeight: 34, borderRadius: 8, background: 'transparent',
  border: '1px solid var(--border-md)', color: 'var(--text-3)',
  fontFamily: 'Geist, sans-serif', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
};

const emptyForm = { full_name: '', phone: '', email: '', nationality: '', id_document_type: '' as '' | 'passport' | 'national_id' | 'other', id_document_number: '', vip_flag: false, notes: '' };

function Badge({ text, colour }: { text: string; colour: string }) {
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontFamily: 'Geist, sans-serif', fontSize: '0.64rem', fontWeight: 700, color: colour, background: `color-mix(in srgb, ${colour} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${colour} 40%, transparent)` }}>{text}</span>;
}

export default function GuestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const load = useCallback(async (q?: string) => {
    setError('');
    try { setGuests(await listGuests(q)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load guests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.full_name.trim()) return;
    setBusy(true); setError('');
    try {
      await createGuest({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        nationality: form.nationality.trim() || undefined,
        id_document_type: form.id_document_type || undefined,
        id_document_number: form.id_document_number.trim() || undefined,
        vip_flag: form.vip_flag,
        notes: form.notes.trim() || undefined,
      });
      setForm(emptyForm); setShowAdd(false); await load(search);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add guest.'); }
    finally { setBusy(false); }
  };

  const reveal = async (id: string) => {
    try { const g = await getGuest(id, true); setRevealed(r => ({ ...r, [id]: g.id_document_number || '—' })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not reveal ID.'); }
  };

  return (
    <>
      {error && <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.8rem' }}>{error}</div>}

      <SectionCard
        title="Guests"
        subtitle={loading ? 'Loading…' : `${guests.length} on file`}
        action={<button style={primaryBtn} onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Close' : '+ Add guest'}</button>}
      >
        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input style={{ ...input, flex: 1 }} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load(search); }} placeholder="Search name, email or phone…" />
          <button style={ghostBtn} onClick={() => load(search)}>Search</button>
          {search && <button style={ghostBtn} onClick={() => { setSearch(''); load(); }}>Clear</button>}
        </div>

        {/* Add form */}
        {showAdd && (
          <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-badge)', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Full name</label><input style={input} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><label style={lbl}>Phone (WhatsApp)</label><input style={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+2609…" /></div>
              <div><label style={lbl}>Email</label><input style={input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label style={lbl}>Nationality</label><input style={input} value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} /></div>
              <div>
                <label style={lbl}>ID type</label>
                <select style={input} value={form.id_document_type} onChange={e => setForm({ ...form, id_document_type: e.target.value as typeof form.id_document_type })}>
                  <option value="">—</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label style={lbl}>ID number (sealed)</label><input style={input} value={form.id_document_number} onChange={e => setForm({ ...form, id_document_number: e.target.value })} placeholder="Encrypted at rest" /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Staff notes (private)</label><input style={input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Preferences, discretion notes…" /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.vip_flag} onChange={e => setForm({ ...form, vip_flag: e.target.checked })} /> VIP guest
            </label>
            <div style={{ marginTop: 14 }}>
              <button style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={busy || !form.full_name.trim()} onClick={add}>{busy ? 'Saving…' : 'Save guest'}</button>
            </div>
          </div>
        )}

        {/* List */}
        {!loading && guests.length === 0 && <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', color: 'var(--text-4)' }}>No guests yet — they’re also created automatically when you name one on a booking.</p>}

        <div style={{ display: 'grid', gap: 8 }}>
          {guests.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-1)' }}>{g.full_name}</div>
                <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--text-3)' }}>
                  {[g.phone, g.email, g.nationality].filter(Boolean).join(' · ') || 'No contact on file'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {g.vip_flag && <Badge text="VIP" colour="var(--amber)" />}
                {g.is_repeat_guest && <Badge text={`Repeat · ${g.stay_count ?? 0}`} colour="var(--green)" />}
                {g.id_document_on_file && (
                  revealed[g.id]
                    ? <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--text-2)' }}>{g.id_document_type}: {revealed[g.id]}</span>
                    : <button style={ghostBtn} onClick={() => reveal(g.id)} title="Reveal sealed ID">{g.id_document_masked || 'ID on file'} · reveal</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
