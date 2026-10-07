'use client';
/**
 * Guests — the CRM master record. Repeat/VIP recognition the OTAs can't give a
 * small host (they hide the guest behind the platform). ID document capture is
 * sealed at rest (Fernet, server-side) for the embassy/corporate segment — the raw
 * number is never listed; a masked tail shows, and "reveal" is an explicit action.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SectionCard from '@/components/ui/SectionCard';
import { Chip, Note } from '@/components/hospitality/kit';
import { useProfile } from '@/lib/profile';
import {
  listGuests, createGuest, getGuest, type Guest,
} from '@/lib/hospitality';


const emptyForm = { full_name: '', phone: '', email: '', nationality: '', id_document_type: '' as '' | 'passport' | 'national_id' | 'other', id_document_number: '', vip_flag: false, notes: '' };

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export default function GuestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  // Unsealing a passport or NRC number is the owner's call. Staff run the
  // stay and see the masked tail; the server refuses the rest, so offering
  // a button that always fails would only look broken.
  const { teamRole } = useProfile();
  const canReveal = teamRole === 'owner';

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
    try { const g = await getGuest(id, true); setRevealed(r => ({ ...r, [id]: g.id_document_number || 'None' })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not reveal ID.'); }
  };

  return (
    <>
      {error && <div style={{ marginBottom: 16 }}><Note tone="bad">{error}</Note></div>}

      <SectionCard
        title="Guests"
        subtitle={loading ? 'Loading…' : `${guests.length} on file`}
        action={<button className="pill pill-primary" onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Close' : '+ Add guest'}</button>}
      >
        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input className="field" style={{ flex: 1 }} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load(search); }} placeholder="Search name, email or phone…" />
          <button className="pill pill-quiet" onClick={() => load(search)}>Search</button>
          {search && <button className="pill pill-quiet" onClick={() => { setSearch(''); load(); }}>Clear</button>}
        </div>

        {/* Add form */}
        {showAdd && (
          <div style={{ padding: 18, borderRadius: 'var(--radius-lg)', background: 'var(--pill-bg)', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Full name</label><input className="field" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><label className="field-label">Phone (WhatsApp)</label><input className="field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+2609…" /></div>
              <div><label className="field-label">Email</label><input className="field" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="field-label">Nationality</label><input className="field" value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} /></div>
              <div>
                <label className="field-label">ID type</label>
                <select className="field" value={form.id_document_type} onChange={e => setForm({ ...form, id_document_type: e.target.value as typeof form.id_document_type })}>
                  <option value="">Choose…</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label className="field-label">ID number (sealed)</label><input className="field" value={form.id_document_number} onChange={e => setForm({ ...form, id_document_number: e.target.value })} placeholder="Encrypted at rest" /></div>
              <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Staff notes (private)</label><input className="field" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Preferences, discretion notes…" /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 'var(--fs-data)', color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.vip_flag} onChange={e => setForm({ ...form, vip_flag: e.target.checked })} /> VIP guest
            </label>
            <div style={{ marginTop: 14 }}>
              <button type="button" className="rs-btn is-navy" disabled={busy || !form.full_name.trim()} onClick={add}>{busy ? 'Saving…' : 'Save guest'}</button>
            </div>
          </div>
        )}

        {/* List */}
        {!loading && guests.length === 0 && <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-4)' }}>No guests yet: they’re also created automatically when you name one on a booking.</p>}

        {/* Each guest as the calendar draws a person: initials in a navy
            circle. The name opens their page with every stay they have had. */}
        <div className="rs-list">
          {guests.map(g => (
            <div key={g.id} className="rs-row">
              <span className="rs-avatar" aria-hidden="true">{initials(g.full_name)}</span>
              <div className="rs-row-main">
                <Link href={`/dashboard/hospitality/guests/${encodeURIComponent(g.id)}`} className="rs-row-title" style={{ color: 'var(--text-1)', textDecoration: 'underline', textDecorationColor: 'var(--border-md)', textUnderlineOffset: 3 }}>
                  {g.full_name}
                </Link>
                <span className="rs-row-line">
                  {[g.phone, g.email, g.nationality].filter(Boolean).join(' · ') || 'No contact on file'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {g.vip_flag && <Chip>VIP</Chip>}
                {g.is_repeat_guest && <Chip>Repeat · {g.stay_count ?? 0}</Chip>}
                {g.id_document_on_file && (
                  revealed[g.id]
                    ? <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-2)' }}>{g.id_document_type}: {revealed[g.id]}</span>
                    : canReveal
                      ? <button type="button" className="rs-btn is-quiet is-sm" onClick={() => reveal(g.id)} title="Reveal sealed ID">{g.id_document_masked || 'ID on file'} · reveal</button>
                      : <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }} title="Only the owner can reveal a sealed ID">{g.id_document_masked || 'ID on file'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
