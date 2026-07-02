'use client';

// Business Profile — each business's essential data lives here. Editable by the
// owner (saved to their own `profiles` row via RLS self-update). Reachable from
// the header profile chip; the chip's name + logo are sourced from this page.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/lib/profile';
import { TIERS } from '@/lib/tiers';

const BUSINESS_TYPES = [
  'Restaurant',
  'Retail',
  'Service',
  'Mine',
  'Hospitality',
  'Other',
] as const;

const CURRENCIES = ['ZMW', 'USD', 'EUR', 'GBP'] as const;

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
  fontFamily: 'Geist, sans-serif',
  fontSize: '0.76rem',
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
  fontFamily: 'Geist, sans-serif',
  fontSize: '0.85rem',
  outline: 'none',
};

export default function BusinessProfilePage() {
  const { user } = useAuth();
  const { profile, loading, refresh } = useProfile();

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
          <p style={{ fontFamily: 'Geist, sans-serif', color: 'var(--text-3)', margin: 0 }}>
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
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Business profile
        </h1>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
          The details here power your dashboard identity — the name and logo shown in the header come from this page.
        </p>
      </header>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', maxWidth: 980 }}>
        {/* Editable form */}
        <form onSubmit={onSubmit} className="section-card" noValidate>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
            {form.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="" width={56} height={56} style={{ borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
            ) : (
              <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, var(--e1), var(--cyan))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Geist, sans-serif', fontSize: '1rem', fontWeight: 800 }}>
                {initials}
              </span>
            )}
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={logoBusy}
                style={{ minHeight: 44, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-badge)', color: 'var(--text-1)', fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: logoBusy ? 'wait' : 'pointer', opacity: logoBusy ? 0.6 : 1 }}
              >
                {logoBusy ? 'Uploading…' : form.logo_url ? 'Replace logo' : 'Upload logo'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} aria-label="Upload business logo" style={{ display: 'none' }} />
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)', margin: '8px 0 0' }}>
                PNG or JPG · shown in the header
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div>
              <label htmlFor="bp-name" style={labelStyle}>Business name <span style={{ color: 'var(--crit)' }}>*</span></label>
              <input id="bp-name" value={form.business_name} onChange={(e) => set('business_name', e.target.value)} required aria-required="true" aria-invalid={!nameValid} style={inputStyle} placeholder="e.g. Lusaka Bites" />
              {!nameValid && <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--crit)', margin: '6px 0 0' }}>A business name is required.</p>}
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
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
              {!emailValid && <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--crit)', margin: '6px 0 0' }}>Enter a valid email address.</p>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={!canSave}
              style={{ minHeight: 44, padding: '12px 22px', borderRadius: 10, border: 'none', background: 'var(--cyan)', color: '#fff', fontFamily: 'Geist, sans-serif', fontSize: '0.86rem', fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.55 }}
            >
              {save === 'saving' ? 'Saving…' : 'Save changes'}
            </button>

            {/* aria-live save confirmation / error */}
            <span role="status" aria-live="polite" style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', color: save === 'error' ? 'var(--crit)' : 'var(--good)' }}>
              {save === 'saved' && 'Saved.'}
              {save === 'error' && (errorMsg || 'Could not save.')}
            </span>
          </div>
        </form>

        {/* Read-only account facts */}
        <div className="section-card">
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
            Account
          </p>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--text-3)', margin: '0 0 4px' }}>Plan</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-1)' }}>{TIERS[tier].name}</span>
                <Link href="/pricing" style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.74rem', fontWeight: 600, color: 'var(--cyan)', textDecoration: 'none' }}>
                  {tier === 'growth' ? 'Manage' : 'Upgrade'} →
                </Link>
              </div>
            </div>
            <div>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--text-3)', margin: '0 0 4px' }}>Member since</p>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{fmtDate(profile?.created_at ?? null)}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--text-3)', margin: '0 0 4px' }}>Last active</p>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{fmtDate(profile?.last_active_at ?? null)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
