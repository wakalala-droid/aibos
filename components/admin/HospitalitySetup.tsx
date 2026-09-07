'use client';

/**
 * Admin · set up a customer's booking website.
 *
 * Everything a property needs to take bookings through AI-BOS lives inside the
 * customer's own account: the property, its units, and the key their website
 * uses. So connecting a client's site used to mean signing in as the client,
 * which is not something a platform operator should have to do and does not
 * survive the second customer.
 *
 * This does it from the outside. Every row is written against the CUSTOMER's
 * account and every action is logged under the admin's own email. It can touch
 * properties, units and the website key, and nothing else: no guests, no
 * bookings, no sealed ID documents.
 */

import { useCallback, useEffect, useState } from 'react';
import { slugFrom } from '@/lib/slug';

interface UnitRow {
  id?: string;
  unit_name: string;
  bedrooms: string;
  bathrooms: string;
  max_guests: string;
  base_nightly_rate: string;
  currency: string;
  public_slug?: string | null;
}

interface State {
  profile: { id: string; email: string | null; business_name: string | null; tier: string };
  tier: string;
  entitled: boolean;
  needsTier: string;
  property: { id: string; name: string; address: string | null; status: string; public_site_token: string | null } | null;
  units: Array<{
    id: string; unit_name: string; bedrooms: number; bathrooms: number;
    max_guests: number; base_nightly_rate: number; currency: string; public_slug: string | null;
  }>;
}

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontSize: 15, outline: 'none',
};
const lbl: React.CSSProperties = {
  fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};
const primaryBtn: React.CSSProperties = {
  padding: '9px 16px', minHeight: 40, borderRadius: 8, border: 'none',
  background: 'var(--cyan)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '8px 14px', minHeight: 38, borderRadius: 8, background: 'transparent',
  border: '1px solid var(--border-md)', color: 'var(--text-2)',
  fontSize: 15, fontWeight: 600, cursor: 'pointer',
};

const emptyUnit = (): UnitRow => ({
  unit_name: '', bedrooms: '1', bathrooms: '1', max_guests: '2',
  base_nightly_rate: '', currency: 'ZMW',
});

export default function HospitalitySetup({ userId }: { userId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const [propertyName, setPropertyName] = useState('');
  const [address, setAddress] = useState('');
  const [units, setUnits] = useState<UnitRow[]>([emptyUnit()]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/admin/hospitality/${userId}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Failed to load (${r.status})`);
      setState(j as State);
      if (!propertyName && (j as State).profile?.business_name) {
        setPropertyName((j as State).profile.business_name ?? '');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // propertyName is intentionally not a dependency: reloading must not stamp
    // over what the admin has already typed into the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setError('');
    try {
      const r = await fetch(`/api/admin/hospitality/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
      setState(j as State);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const copy = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    });
  };

  if (loading) return <div className="section-card" style={{ marginBottom: 16 }}><div className="skeleton" style={{ height: 90 }} /></div>;
  if (!state) {
    return (
      <div className="section-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 15, color: 'var(--crit)', margin: 0 }}>{error || 'Could not load.'}</p>
      </div>
    );
  }

  const token = state.property?.public_site_token ?? '';

  return (
    <div className="section-card" style={{ marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: 'var(--text-1)' }}>
        Booking website
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)' }}>
        Set this customer&rsquo;s property up so their own website takes bookings through
        AI-BOS. Everything here is written to their account, not yours, and every
        action is logged against your email.
      </p>

      {error && (
        <p role="alert" style={{
          margin: '0 0 12px', padding: '10px 12px', borderRadius: 8, fontSize: 15, lineHeight: 1.6,
          background: 'color-mix(in srgb, var(--crit) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--crit) 35%, transparent)', color: 'var(--crit)',
        }}>
          {error}
        </p>
      )}

      {!state.entitled && (
        <p style={{
          margin: '0 0 12px', padding: '10px 12px', borderRadius: 8, fontSize: 15, lineHeight: 1.6,
          background: 'color-mix(in srgb, var(--warn) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--warn) 35%, transparent)', color: 'var(--text-1)',
        }}>
          This account is on <strong>{state.tier}</strong>, which does not include the
          hospitality module. Grant it <strong>{state.needsTier}</strong> above first,
          or they will open a locked screen and their website key will answer nothing.
        </p>
      )}

      {/* ── Already set up ──────────────────────────────────────────────── */}
      {state.property ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{state.property.name}</span>
            <span className="badge" style={{
              color: token ? 'var(--good)' : 'var(--text-4)',
              borderColor: token ? 'var(--good)' : 'var(--border)',
            }}>
              {token ? 'WEBSITE CONNECTED' : 'NO WEBSITE KEY'}
            </span>
          </div>

          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Units and the web address each answers to
          </p>
          <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
            {state.units.length === 0 && (
              <li style={{ fontSize: 15, color: 'var(--text-3)' }}>No units. Nothing can be booked until there is at least one.</li>
            )}
            {state.units.map((u) => (
              <li key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '2px 0' }}>
                <code style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                  {u.public_slug || slugFrom(u.unit_name)}
                </code>
                <span style={{ fontSize: 15, color: 'var(--text-3)' }}>
                  {u.unit_name} · sleeps {u.max_guests} · {u.currency} {u.base_nightly_rate}/night
                </span>
              </li>
            ))}
          </ul>

          {token ? (
            <>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)', margin: '0 0 8px' }}>
                Put these two settings into the customer&rsquo;s website, then redeploy it.
              </p>
              <Setting
                name="NEXT_PUBLIC_AIBOS_API_URL"
                value={apiBase}
                missing={!apiBase}
                copied={copied === 'url'}
                onCopy={() => copy('url', apiBase)}
              />
              <Setting
                name="NEXT_PUBLIC_AIBOS_SITE_TOKEN"
                value={token}
                copied={copied === 'token'}
                onCopy={() => copy('token', token)}
              />
            </>
          ) : (
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)', margin: '0 0 8px' }}>
              This property has no website key. Mint one to let their site read
              availability and send booking requests.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" style={token ? ghostBtn : primaryBtn} disabled={busy !== ''} onClick={() => act('mint')}>
              {busy === 'mint' ? 'Working…' : token ? 'New key' : 'Mint the website key'}
            </button>
            {token && (
              <button type="button" style={ghostBtn} disabled={busy !== ''} onClick={() => {
                if (confirm('Take this customer’s website offline? It stops showing availability and stops taking requests.')) void act('clear');
              }}>
                Take offline
              </button>
            )}
          </div>
          {token && (
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '8px 0 0', lineHeight: 1.6 }}>
              A new key cuts off the site running on the old one until it is redeployed.
            </p>
          )}
        </>
      ) : (
        /* ── First-time setup ─────────────────────────────────────────────── */
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Property name</label>
              <input style={input} value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="Dunslim Apartments" />
            </div>
            <div>
              <label style={lbl}>Address (optional)</label>
              <input style={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Makeni Road, Lusaka" />
            </div>
          </div>

          {units.map((u, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Unit {i + 1} name</label>
                  <input
                    style={input}
                    value={u.unit_name}
                    onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, unit_name: e.target.value } : x)))}
                    placeholder="Mandela"
                  />
                  {u.unit_name.trim() && (
                    <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '4px 0 0' }}>
                      Their website will ask for <strong>{slugFrom(u.unit_name)}</strong>.
                    </p>
                  )}
                </div>
                <div><label style={lbl}>Bedrooms</label><input style={input} type="number" min="0" value={u.bedrooms} onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, bedrooms: e.target.value } : x)))} /></div>
                <div><label style={lbl}>Bathrooms</label><input style={input} type="number" min="0" step="0.5" value={u.bathrooms} onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, bathrooms: e.target.value } : x)))} /></div>
                <div><label style={lbl}>Sleeps</label><input style={input} type="number" min="1" value={u.max_guests} onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, max_guests: e.target.value } : x)))} /></div>
                <div><label style={lbl}>Rate/night</label><input style={input} type="number" min="0" value={u.base_nightly_rate} onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, base_nightly_rate: e.target.value } : x)))} placeholder="2000" /></div>
                <div><label style={lbl}>Currency</label><input style={input} value={u.currency} onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, currency: e.target.value } : x)))} /></div>
              </div>
              {units.length > 1 && (
                <button type="button" style={{ ...ghostBtn, marginTop: 8, color: 'var(--crit)', borderColor: 'color-mix(in srgb, var(--crit) 40%, transparent)' }}
                  onClick={() => setUnits(units.filter((_, j) => j !== i))}>
                  Remove unit {i + 1}
                </button>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" style={ghostBtn} onClick={() => setUnits([...units, emptyUnit()])}>
              Add another unit
            </button>
            <button
              type="button"
              style={{ ...primaryBtn, opacity: !state.entitled || busy !== '' ? 0.55 : 1 }}
              disabled={!state.entitled || busy !== ''}
              onClick={() => act('setup', {
                property: { name: propertyName, address },
                units: units.map((u) => ({
                  unit_name: u.unit_name,
                  bedrooms: u.bedrooms,
                  bathrooms: u.bathrooms,
                  max_guests: u.max_guests,
                  base_nightly_rate: u.base_nightly_rate,
                  currency: u.currency,
                })),
              })}
            >
              {busy === 'setup' ? 'Setting up…' : 'Set up and mint the website key'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** One copy-me setting line. */
function Setting({ name, value, missing, copied, onCopy }: {
  name: string; value: string; missing?: boolean; copied: boolean; onCopy: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
      <code style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', minWidth: 210, fontFamily: 'inherit', fontWeight: 600 }}>
        {name}
      </code>
      <code style={{
        flex: '1 1 220px', minWidth: 0, padding: '6px 10px', borderRadius: 6,
        background: 'var(--bg-input)', border: '1px solid var(--border-md)',
        fontSize: 'var(--fs-label)', fontFamily: 'inherit',
        color: missing ? 'var(--crit)' : 'var(--text-1)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {missing ? 'NEXT_PUBLIC_API_URL is not set on this deployment' : value}
      </code>
      <button type="button" style={ghostBtn} disabled={missing} onClick={onCopy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
