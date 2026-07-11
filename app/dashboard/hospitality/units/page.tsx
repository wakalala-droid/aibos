'use client';
/**
 * Units — the SINGLE SOURCE OF TRUTH editor.
 *
 * The client audit found the same physical units listed with conflicting
 * amenities, bed counts and prices across OTAs. This screen is the fix: amenities,
 * bed/bath, max guests and base rate live here ONCE per unit. Every channel's iCal
 * feed and (later) full API sync pulls from this record — edit once, never per-listing.
 */
import { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { fmt, symbolForToken, CURRENCIES } from '@/lib/currency';
import {
  listProperties, listUnits, createProperty, createUnit, updateUnit, deleteUnit,
  type Property, type Unit,
} from '@/lib/hospitality';

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontSize: 'var(--fs-body)', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};
const primaryBtn: React.CSSProperties = {
  padding: '9px 16px', minHeight: 38, borderRadius: 8, border: 'none', background: 'var(--cyan)',
  color: '#fff', fontSize: 'var(--fs-data)', fontWeight: 700, cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '8px 14px', minHeight: 36, borderRadius: 8, background: 'transparent',
  border: '1px solid var(--border-md)', color: 'var(--text-3)',
  fontSize: 'var(--fs-data)', fontWeight: 600, cursor: 'pointer',
};

export default function UnitsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newProp, setNewProp] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [props, us] = await Promise.all([listProperties(), listUnits()]);
      setProperties(props); setUnits(us);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load units.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const addProperty = async () => {
    if (!newProp.trim()) return;
    setBusy(true); setError('');
    try { await createProperty({ name: newProp.trim() }); setNewProp(''); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not add property.'); }
    finally { setBusy(false); }
  };
  const addUnit = async (propertyId: string) => {
    if (!newUnit.trim()) return;
    setBusy(true); setError('');
    try { await createUnit({ property_id: propertyId, unit_name: newUnit.trim() }); setNewUnit(''); setAddingTo(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not add unit.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      {error && <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-data)' }}>{error}</div>}

      {/* Add property */}
      <SectionCard title="Properties" subtitle="Each property holds one or more lettable units.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl}>New property name</label>
            <input style={input} value={newProp} onChange={e => setNewProp(e.target.value)} placeholder="Dunslim Apartments — Makeni Road" />
          </div>
          <button style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={addProperty}>Add property</button>
        </div>
      </SectionCard>

      {loading && <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', marginTop: 16 }}>Loading…</p>}

      {properties.map(p => {
        const propUnits = units.filter(u => u.property_id === p.id);
        return (
          <div key={p.id} style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{p.name}</h2>
              <button style={ghostBtn} onClick={() => { setAddingTo(addingTo === p.id ? null : p.id); setNewUnit(''); }}>{addingTo === p.id ? 'Close' : '+ Add unit'}</button>
            </div>

            {addingTo === p.id && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Unit name</label>
                  <input style={input} value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="Unit A — 2BR" autoFocus />
                </div>
                <button style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={() => addUnit(p.id)}>Add</button>
              </div>
            )}

            {propUnits.length === 0 && addingTo !== p.id && (
              <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-4)' }}>No units yet.</p>
            )}

            <div style={{ display: 'grid', gap: 14 }}>
              {propUnits.map(u => <UnitEditor key={u.id} unit={u} onSaved={load} onError={setError} />)}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── One unit — its own edit form (the source-of-truth record) ────────────────
function UnitEditor({ unit, onSaved, onError }: { unit: Unit; onSaved: () => Promise<void>; onError: (m: string) => void }) {
  const [f, setF] = useState({
    unit_name: unit.unit_name,
    bedrooms: String(unit.bedrooms ?? 0),
    bathrooms: String(unit.bathrooms ?? 0),
    max_guests: String(unit.max_guests ?? 1),
    base_nightly_rate: String(unit.base_nightly_rate ?? 0),
    currency: unit.currency || 'ZMW',
  });
  const [amenities, setAmenities] = useState<string[]>(unit.amenities || []);
  const [amenityDraft, setAmenityDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const sym = symbolForToken(f.currency) || 'K';

  const set = (k: keyof typeof f, v: string) => { setF(prev => ({ ...prev, [k]: v })); setSaved(false); };
  const addAmenity = () => {
    const a = amenityDraft.trim();
    if (a && !amenities.some(x => x.toLowerCase() === a.toLowerCase())) { setAmenities([...amenities, a]); setSaved(false); }
    setAmenityDraft('');
  };

  const save = async () => {
    setBusy(true); onError('');
    try {
      await updateUnit(unit.id, {
        unit_name: f.unit_name.trim(),
        bedrooms: Number(f.bedrooms) || 0,
        bathrooms: Number(f.bathrooms) || 0,
        max_guests: Number(f.max_guests) || 1,
        base_nightly_rate: Number(f.base_nightly_rate) || 0,
        currency: f.currency,
        amenities,
      });
      setSaved(true);
      await onSaved();
    } catch (e) { onError(e instanceof Error ? e.message : 'Could not save unit.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`Delete “${unit.unit_name}”? Its bookings keep their history.`)) return;
    setBusy(true); onError('');
    try { await deleteUnit(unit.id); await onSaved(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Could not delete unit.'); }
    finally { setBusy(false); }
  };

  return (
    <SectionCard
      title={unit.unit_name}
      subtitle={`${fmt(unit.base_nightly_rate, false, sym)}/night · sleeps ${unit.max_guests}`}
      action={<span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>Pushed to every channel</span>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Unit name</label><input style={input} value={f.unit_name} onChange={e => set('unit_name', e.target.value)} /></div>
        <div><label style={lbl}>Bedrooms</label><input style={input} type="number" min="0" value={f.bedrooms} onChange={e => set('bedrooms', e.target.value)} /></div>
        <div><label style={lbl}>Bathrooms</label><input style={input} type="number" min="0" step="0.5" value={f.bathrooms} onChange={e => set('bathrooms', e.target.value)} /></div>
        <div><label style={lbl}>Max guests</label><input style={input} type="number" min="1" value={f.max_guests} onChange={e => set('max_guests', e.target.value)} /></div>
        <div><label style={lbl}>Rate ({sym})/night</label><input style={input} type="number" min="0" value={f.base_nightly_rate} onChange={e => set('base_nightly_rate', e.target.value)} /></div>
        <div>
          <label style={lbl}>Currency</label>
          <select style={input} value={f.currency} onChange={e => set('currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </div>

      {/* Amenities — canonical list every listing inherits */}
      <div style={{ marginTop: 14 }}>
        <label style={lbl}>Amenities (the canonical list)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {amenities.length === 0 && <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-4)' }}>None yet — add the real ones so no listing can diverge.</span>}
          {amenities.map(a => (
            <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, background: 'var(--bg-badge)', border: '1px solid var(--border-md)', fontSize: 'var(--fs-label)', color: 'var(--text-2)' }}>
              {a}
              <button aria-label={`Remove ${a}`} onClick={() => { setAmenities(amenities.filter(x => x !== a)); setSaved(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 'var(--fs-data)', lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...input, flex: 1 }} value={amenityDraft} onChange={e => setAmenityDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(); } }} placeholder="Wi-Fi, pool, backup power…" />
          <button style={ghostBtn} onClick={addAmenity}>Add</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
        <button style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button style={{ ...ghostBtn, color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)' }} onClick={remove}>Delete</button>
        {saved && <span style={{ fontSize: 'var(--fs-data)', color: 'var(--green)' }}>Saved ✓</span>}
      </div>
    </SectionCard>
  );
}
