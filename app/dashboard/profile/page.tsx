'use client';

// Business Profile — each business's essential data lives here. Editable by the
// owner (saved to their own `profiles` row via RLS self-update). Reachable from
// the header profile chip; the chip's name + logo are sourced from this page.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/lib/profile';
import { TIERS, canAccess, type Tier } from '@/lib/tiers';
import { useStore } from '@/lib/store';
import { CURRENCIES } from '@/lib/currency';
import {
  briefDeliveryConfig, listMembers, inviteMember, updateMemberRole, revokeMember,
  getMemorySummary, getMemoryMappings, forgetMapping, exportEventsCsv, exportPnlCsv,
  type TeamMember, type TeamMemberRole,
} from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';

const BUSINESS_TYPES = [
  'Restaurant',
  'Retail',
  'Service',
  'Mine',
  'Hospitality',
  'Other',
] as const;

interface FormState {
  business_name: string;
  business_type: string;
  industry: string;
  location: string;
  currency: string;
  phone: string;
  whatsapp: string;
  contact_email: string;
  logo_url: string;
}

const EMPTY: FormState = {
  business_name: '',
  business_type: '',
  industry: '',
  location: 'Lusaka',
  currency: 'ZMW',
  phone: '',
  whatsapp: '',
  contact_email: '',
  logo_url: '',
};

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--fs-data)',
  fontWeight: 600,
  color: 'var(--text-2)',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid var(--border-md)',
  background: 'var(--bg-input)',
  color: 'var(--text-1)',
  fontSize: 'var(--fs-body)',
  outline: 'none',
};

export default function BusinessProfilePage() {
  const { user } = useAuth();
  const { profile, loading, refresh, teamRole } = useProfile();
  const setCurrency = useStore((s) => s.setCurrency);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const hydrated = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Populate the form from the loaded profile once.
  useEffect(() => {
    if (profile && !hydrated.current) {
      hydrated.current = true;
      setForm({
        business_name: profile.business_name ?? '',
        business_type: profile.business_type ?? '',
        industry: profile.industry ?? '',
        location: profile.location ?? 'Lusaka',
        currency: profile.currency ?? 'ZMW',
        phone: profile.phone ?? '',
        whatsapp: profile.whatsapp ?? '',
        contact_email: profile.contact_email ?? '',
        logo_url: profile.logo_url ?? '',
      });
    }
  }, [profile]);

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (save !== 'idle') setSave('idle');
  };

  const emailValid = useMemo(
    () => form.contact_email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim()),
    [form.contact_email]
  );
  const nameValid = form.business_name.trim().length > 0;
  const canSave = nameValid && emailValid && save !== 'saving';

  async function persist(patch: Record<string, string | null>) {
    if (!user) return;
    // Save via the server route — RLS blocks the browser's direct self-update on
    // `profiles`, so writes must go through /api/profile (service role).
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not save. Please try again.');
    }
    await refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !user) return;
    setSave('saving');
    setErrorMsg('');
    const currencyChanged = (profile?.currency ?? 'ZMW') !== form.currency;
    try {
      await persist({
        business_name: form.business_name.trim(),
        business_type: form.business_type || null,
        industry: form.industry.trim() || null,
        location: form.location.trim() || 'Lusaka',
        currency: form.currency || 'ZMW',
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        contact_email: form.contact_email.trim() || null,
      });
      // A deliberate currency edit here is a manual pick — mirror it across the
      // app immediately (the store maps the ISO code to its display symbol).
      if (currencyChanged && form.currency) setCurrency(form.currency, 'manual');
      setSave('saved');
    } catch (err) {
      setSave('error');
      setErrorMsg((err as Error).message || 'Could not save. Please try again.');
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setSave('error');
      setErrorMsg('Please choose an image file for the logo.');
      return;
    }
    setLogoBusy(true);
    setErrorMsg('');
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      const url = data.publicUrl;
      setForm((f) => ({ ...f, logo_url: url }));
      await persist({ logo_url: url });
      setSave('saved');
    } catch (err) {
      setSave('error');
      setErrorMsg(
        (err as Error).message ||
          'Logo upload failed. Make sure the "logos" storage bucket exists and is public.'
      );
    } finally {
      setLogoBusy(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && !profile) {
    return (
      <div style={{ padding: '24px 0' }}>
        <div className="section-card" aria-busy="true" style={{ maxWidth: 760 }}>
          <p style={{ color: 'var(--text-3)', margin: 0 }}>
            Loading your business profile…
          </p>
        </div>
      </div>
    );
  }

  const tier = profile?.tier ?? 'free';
  const initials = (form.business_name || 'AB').trim().slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: '8px 0 48px' }}>
      <PageHeader
        title="Business profile"
        subtitle="The details here power your dashboard identity — the name and logo shown in the header come from this page."
      />

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', maxWidth: 980 }}>
        {/* Editable form */}
        <form onSubmit={onSubmit} className="section-card" noValidate>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
            {form.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="" width={56} height={56} style={{ borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
            ) : (
              <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, var(--e1), var(--cyan))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800 }}>
                {initials}
              </span>
            )}
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={logoBusy}
                style={{ minHeight: 44, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-badge)', color: 'var(--text-1)', fontSize: 'var(--fs-data)', fontWeight: 600, cursor: logoBusy ? 'wait' : 'pointer', opacity: logoBusy ? 0.6 : 1 }}
              >
                {logoBusy ? 'Uploading…' : form.logo_url ? 'Replace logo' : 'Upload logo'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} aria-label="Upload business logo" style={{ display: 'none' }} />
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '8px 0 0' }}>
                PNG or JPG · shown in the header
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div>
              <label htmlFor="bp-name" style={labelStyle}>Business name <span style={{ color: 'var(--crit)' }}>*</span></label>
              <input id="bp-name" value={form.business_name} onChange={(e) => set('business_name', e.target.value)} required aria-required="true" aria-invalid={!nameValid} style={inputStyle} placeholder="e.g. Lusaka Bites" />
              {!nameValid && <p style={{ fontSize: 'var(--fs-label)', color: 'var(--crit)', margin: '6px 0 0' }}>A business name is required.</p>}
            </div>

            <div>
              <label htmlFor="bp-type" style={labelStyle}>Business type</label>
              <select id="bp-type" value={form.business_type} onChange={(e) => set('business_type', e.target.value)} style={inputStyle}>
                <option value="">Select a type…</option>
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="bp-industry" style={labelStyle}>Industry / sub-type</label>
              <input id="bp-industry" value={form.industry} onChange={(e) => set('industry', e.target.value)} style={inputStyle} placeholder="e.g. Fast food" />
            </div>

            <div>
              <label htmlFor="bp-location" style={labelStyle}>Location</label>
              <input id="bp-location" value={form.location} onChange={(e) => set('location', e.target.value)} style={inputStyle} placeholder="Lusaka" />
            </div>

            <div>
              <label htmlFor="bp-currency" style={labelStyle}>Currency</label>
              <select id="bp-currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} style={inputStyle}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{`${c.code} — ${c.name} (${c.symbol})`}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="bp-phone" style={labelStyle}>Phone</label>
              <input id="bp-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={inputStyle} placeholder="e.g. 097 123 4567" />
            </div>

            <div>
              <label htmlFor="bp-whatsapp" style={labelStyle}>WhatsApp</label>
              <input id="bp-whatsapp" type="tel" inputMode="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} style={inputStyle} placeholder="e.g. 097 123 4567" />
            </div>

            <div>
              <label htmlFor="bp-email" style={labelStyle}>Contact email</label>
              <input id="bp-email" type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} aria-invalid={!emailValid} style={inputStyle} placeholder="hello@yourbusiness.com" />
              {!emailValid && <p style={{ fontSize: 'var(--fs-label)', color: 'var(--crit)', margin: '6px 0 0' }}>Enter a valid email address.</p>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={!canSave}
              style={{ minHeight: 44, padding: '12px 22px', borderRadius: 10, border: 'none', background: 'var(--cyan)', color: '#fff', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.55 }}
            >
              {save === 'saving' ? 'Saving…' : 'Save changes'}
            </button>

            {/* aria-live save confirmation / error */}
            <span role="status" aria-live="polite" style={{ fontSize: 'var(--fs-data)', color: save === 'error' ? 'var(--crit)' : 'var(--good)' }}>
              {save === 'saved' && 'Saved.'}
              {save === 'error' && (errorMsg || 'Could not save.')}
            </span>
          </div>
        </form>

        {/* Read-only account facts */}
        <div className="section-card">
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
            Account
          </p>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 4px' }}>Plan</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 800, color: 'var(--text-1)' }}>{TIERS[tier].name}</span>
                <Link href="/pricing" style={{ fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--cyan)', textDecoration: 'none' }}>
                  {tier === 'growth' ? 'Manage' : 'Upgrade'} →
                </Link>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 4px' }}>Member since</p>
              <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{fmtDate(profile?.created_at ?? null)}</p>
            </div>
            <div>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 4px' }}>Last active</p>
              <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{fmtDate(profile?.last_active_at ?? null)}</p>
            </div>
          </div>
        </div>

        {/* Referral loop — owners recommending AIBOS to owners is the growth
            engine that costs nothing and carries trust no ad can buy. */}
        {/* Morning Brief delivery — the day's numbers arrive before the day
            starts. Preferences save now; sending activates with the keys. */}
        <BriefDeliveryCard
          tier={(profile?.tier as Tier) ?? 'free'}
          emailEnabled={Boolean(profile?.brief_email_enabled)}
          whatsappNumber={(profile?.whatsapp_number as string | null) ?? ''}
          onSaved={refresh}
        />

        {/* Team — owners only (audit #27/#28). */}
        {teamRole === 'owner' && <TeamCard />}

        {/* What AIBOS has learned (audit #57) — the correction loop made visible. */}
        <MemoryLearnedCard />

        {/* Export your books (audit #27/#28) — data is yours, in CSV. */}
        <ExportCard />

        {user?.id && <InviteCard userId={user.id} />}
      </div>
    </div>
  );
}

function MemoryLearnedCard() {
  const [mem, setMem] = useState<import('@/lib/api').MemorySummary | null>(null);
  const [managing, setManaging] = useState(false);
  const [mappings, setMappings] = useState<import('@/lib/api').MemoryMapping[]>([]);
  useEffect(() => { getMemorySummary().then(setMem).catch(() => {}); }, []);

  async function openManage() {
    setManaging(true);
    try { setMappings(await getMemoryMappings()); } catch { /* */ }
  }
  async function forget(id: string) {
    try { await forgetMapping(id); setMappings((m) => m.filter((x) => x.id !== id)); getMemorySummary().then(setMem).catch(() => {}); } catch { /* */ }
  }
  const describe = (m: import('@/lib/api').MemoryMapping): string => {
    const v = m.value || {};
    if (m.kind === 'alias') return `“${m.key}” → ${String(v.name ?? '')}`;
    if (m.kind === 'category_for_party') return `${m.key} → category ${String(v.category ?? '')}`;
    if (m.kind === 'type_for_keyword') return `“${m.key}” → ${String(v.event_type ?? '')}`;
    return `${m.kind}: ${m.key}`;
  };

  if (!mem?.available || !mem.total) return null;
  return (
    <div className="section-card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>What AIBOS has learned</h2>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 14px' }}>
            Every correction you make teaches AIBOS, so you never enter the same thing twice.
          </p>
        </div>
        <button type="button" onClick={() => managing ? setManaging(false) : void openManage()}
          style={{ flexShrink: 0, minHeight: 32, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-md)', background: managing ? 'var(--bg-badge)' : 'transparent', color: 'var(--text-3)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-label)' }}>
          {managing ? 'Done' : 'Manage'}
        </button>
      </div>

      {!managing ? (
        <>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-1)' }}>{mem.aliases ?? 0}</strong> names learned</span>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-1)' }}>{mem.category_rules ?? 0}</strong> category rules</span>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-1)' }}>{mem.type_rules ?? 0}</strong> shortcuts</span>
          </div>
          {(mem.sample_aliases?.length ?? 0) > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {mem.sample_aliases!.map((a, i) => (
                <div key={i} style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                  “{a.from}” → <strong style={{ color: 'var(--text-2)' }}>{a.to}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '0 0 6px' }}>Wrong? Remove it and AIBOS forgets — you correct it, not the other way round.</p>
          {mappings.length === 0 ? (
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>Nothing learned yet.</span>
          ) : mappings.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-2)', minWidth: 0 }}>{describe(m)}</span>
              <button type="button" onClick={() => void forget(m.id)} aria-label="Forget this"
                style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'var(--fs-label)' }}>Forget</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportCard() {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function run(which: 'events' | 'pnl') {
    setBusy(which); setErr(null);
    try { which === 'events' ? await exportEventsCsv() : await exportPnlCsv(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }
  const btn: React.CSSProperties = { minHeight: 40, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-2)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-data)' };
  return (
    <div className="section-card" style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Export your books</h2>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 14px' }}>
        Your data is yours — pull it out as CSV any time, for your accountant or your own records.
      </p>
      {err && <p role="alert" style={{ color: 'var(--crit)', fontSize: 'var(--fs-label)', margin: '0 0 10px' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={btn} disabled={busy !== null} onClick={() => void run('events')}>{busy === 'events' ? 'Preparing…' : 'Events ledger (CSV)'}</button>
        <button type="button" style={btn} disabled={busy !== null} onClick={() => void run('pnl')}>{busy === 'pnl' ? 'Preparing…' : 'Monthly P&L (CSV)'}</button>
      </div>
    </div>
  );
}

function TeamCard() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMemberRole>('staff');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => { listMembers().then(setMembers).catch(() => {}); };
  useEffect(() => { load(); }, []);

  async function invite() {
    if (!email.trim()) return;
    setBusy(true); setError(null);
    try { await inviteMember(email.trim(), role); setEmail(''); load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function changeRole(id: string, r: TeamMemberRole) {
    try { await updateMemberRole(id, r); load(); } catch (e) { setError((e as Error).message); }
  }
  async function remove(id: string) {
    try { await revokeMember(id); load(); } catch (e) { setError((e as Error).message); }
  }

  const cardInput: React.CSSProperties = { minHeight: 40, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: 'var(--fs-body)' };
  const cardBtn: React.CSSProperties = { minHeight: 36, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-2)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-label)' };

  return (
    <div className="section-card" style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Your team</h2>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 16px' }}>
        Invite a cashier to <strong>record</strong> sales (you confirm them) or an accountant to <strong>view and export</strong> — read-only. The accountant seat is free.
      </p>

      {error && <p role="alert" style={{ color: 'var(--crit)', fontSize: 'var(--fs-label)', margin: '0 0 12px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="teammate@email.com" aria-label="Invite email" style={{ ...cardInput, flex: '1 1 200px' }} />
        <select value={role} onChange={e => setRole(e.target.value as TeamMemberRole)} aria-label="Role" style={cardInput}>
          <option value="staff">Staff — records</option>
          <option value="accountant">Accountant — read-only</option>
        </select>
        <button type="button" style={{ ...cardBtn, color: 'var(--cyan)', borderColor: 'var(--cyan)' }} disabled={busy || !email.trim()} onClick={() => void invite()}>
          {busy ? 'Inviting…' : 'Invite'}
        </button>
      </div>

      {members.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>No team members yet — it&apos;s just you.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)', fontWeight: 600 }}>{m.email}</span>
                <span className="badge" style={{ marginLeft: 8, color: m.status === 'active' ? 'var(--good)' : 'var(--warn)', borderColor: 'var(--border)' }}>
                  {m.status === 'active' ? 'active' : 'invite pending'}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <select value={m.role} onChange={e => void changeRole(m.id, e.target.value as TeamMemberRole)} aria-label={`Role for ${m.email}`} style={{ ...cardInput, minHeight: 32, padding: '4px 8px', fontSize: 'var(--fs-label)' }}>
                  <option value="staff">Staff</option>
                  <option value="accountant">Accountant</option>
                </select>
                <button type="button" style={cardBtn} onClick={() => void remove(m.id)}>Remove</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BriefDeliveryCard({ tier, emailEnabled, whatsappNumber, onSaved }: {
  tier: Tier;
  emailEnabled: boolean;
  whatsappNumber: string;
  onSaved: () => void | Promise<void>;
}) {
  const [emailOn, setEmailOn] = useState(emailEnabled);
  const [waNumber, setWaNumber] = useState(whatsappNumber);
  const [channels, setChannels] = useState<{ email: boolean; whatsapp: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setEmailOn(emailEnabled); }, [emailEnabled]);
  useEffect(() => { setWaNumber(whatsappNumber); }, [whatsappNumber]);
  useEffect(() => {
    let alive = true;
    briefDeliveryConfig().then((c) => { if (alive) setChannels(c); });
    return () => { alive = false; };
  }, []);

  const canEmail = canAccess(tier, 'scheduled_brief');
  const canWa = canAccess(tier, 'morning_brief');

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief_email_enabled: emailOn,
          whatsapp_number: waNumber.trim().replace(/[^\d+]/g, '') || null,
        }),
      });
      if (!res.ok) throw new Error('Could not save — try again.');
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const pill = (label: string) => (
    <Link
      href="/checkout?plan=proplus"
      style={{
        fontSize: 'var(--fs-label)', fontWeight: 700,
        color: 'var(--cyan)', textDecoration: 'none', padding: '3px 9px', borderRadius: 999,
        border: '1px solid color-mix(in srgb, var(--cyan) 40%, transparent)', background: 'var(--cyan-dim)',
      }}
    >
      {label}
    </Link>
  );

  return (
    <div className="section-card">
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
        Morning Brief, delivered
      </p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 16px' }}>
        Your cash, sales, stock and one thing to do — in your inbox or on WhatsApp every morning at 06:30,
        before the day starts. Composed from your real numbers only.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: canEmail ? 'pointer' : 'default', fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>
            <input
              type="checkbox"
              checked={emailOn}
              disabled={!canEmail}
              onChange={(e) => setEmailOn(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--cyan)' }}
            />
            Email me the brief (to your account email)
          </label>
          {!canEmail && pill('Pro')}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="tel"
            inputMode="tel"
            value={waNumber}
            disabled={!canWa}
            onChange={(e) => setWaNumber(e.target.value)}
            placeholder="WhatsApp number, e.g. +260 977 123 456"
            aria-label="WhatsApp number for the Morning Brief"
            style={{
              flex: '1 1 240px', minHeight: 44, padding: '10px 14px', borderRadius: 10,
              border: '1px solid var(--border-md)', background: 'var(--bg-input)',
              color: 'var(--text-1)', fontSize: 'var(--fs-body)',
              opacity: canWa ? 1 : 0.55,
            }}
          />
          {!canWa && pill('Pro+')}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || (!canEmail && !canWa)}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              cursor: saving ? 'default' : 'pointer', background: 'var(--cyan)', color: '#fff',
              fontSize: 'var(--fs-body)', fontWeight: 700,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save delivery settings'}
          </button>
          {error && (
            <span role="alert" style={{ fontSize: 'var(--fs-data)', color: 'var(--crit)' }}>{error}</span>
          )}
        </div>

        {channels && (!channels.email || !channels.whatsapp) && (
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0, lineHeight: 1.5 }}>
            {!channels.email && !channels.whatsapp
              ? 'Delivery is being switched on — your preference is saved and takes effect the moment it goes live.'
              : !channels.email
                ? 'Email delivery is being switched on — WhatsApp is live.'
                : 'WhatsApp delivery is being switched on — email is live.'}
          </p>
        )}
      </div>
    </div>
  );
}

function InviteCard({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);
  const code = userId.replace(/-/g, '').slice(0, 8);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/login?ref=${code}` : `/login?ref=${code}`;
  const waText = `I run my business on AIBOS — it keeps the books, watches my stock and answers questions about my numbers. Try it free: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the link is visible to copy by hand */ }
  }

  return (
    <div className="section-card">
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
        Invite a business owner
      </p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 14px' }}>
        Know someone running a shop, lodge, restaurant or site? When someone you invite subscribes to any paid plan,
        you both get a month of Pro+ free — applied by our team for now.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <code style={{ fontSize: 'var(--fs-data)', color: 'var(--text-1)', background: 'var(--bg-badge)', border: '1px solid var(--border-md)', padding: '9px 12px', borderRadius: 8, wordBreak: 'break-all' }}>
          {link}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          style={{ padding: '9px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-md)', background: 'var(--bg-badge)', color: copied ? 'var(--green)' : 'var(--text-2)', fontSize: 'var(--fs-data)', fontWeight: 700 }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '9px 14px', borderRadius: 8, textDecoration: 'none', background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 35%, transparent)', fontSize: 'var(--fs-data)', fontWeight: 700 }}
        >
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
