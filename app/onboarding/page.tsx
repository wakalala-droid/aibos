'use client';
/**
 * AI-BOS — Business Setup Wizard (Evolution Initiative 1).
 * Start a business on AIBOS with only a phone: a few essentials, everything else
 * optional. "Initial cash" seeds the Digital Twin's opening balance; the rest
 * updates the profile. Mobile-first, one decision at a time (ux_intelligence.md
 * DECISION SIMPLIFICATION), every state handled.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { updateProfile, seedTwin } from '@/lib/api';

const CURRENCIES = [
  { code: 'ZMW', symbol: 'K', label: 'Zambian Kwacha (K)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand (R)' },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling (KSh)' },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira (₦)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
];
const INDUSTRIES = ['Retail', 'Restaurant / Food', 'Services', 'Wholesale', 'Hospitality', 'Manufacturing', 'Agriculture', 'Mining', 'Transport', 'Other'];
const TAX = [
  { v: 'unregistered', l: 'Not registered yet' },
  { v: 'turnover_tax', l: 'Turnover tax' },
  { v: 'vat', l: 'VAT registered' },
];
const LANGUAGES = [
  { v: 'en', l: 'English' }, { v: 'ny', l: 'Nyanja' }, { v: 'bem', l: 'Bemba' },
  { v: 'toi', l: 'Tonga' }, { v: 'other', l: 'Other' },
];

const STEPS = ['Business', 'Money', 'Operations', 'Review'];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', minHeight: 48,
  background: 'var(--bg-input)', border: '1px solid var(--border-md)', borderRadius: 8,
  color: 'var(--text-1)', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', fontWeight: 600,
  color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: 8, display: 'block',
};
const fieldGap: React.CSSProperties = { marginBottom: 18 };

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, initialized } = useAuth();
  const { profile } = useProfile();
  const setCurrency = useStore(s => s.setCurrency);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    business_name: '', industry: '', currency: 'ZMW',
    initial_cash: '', tax_status: 'unregistered',
    employees: '', operating_hours: '', location: '', language: 'en',
  });
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Redirect unauthenticated users to login; prefill from any existing profile.
  useEffect(() => {
    if (initialized && !isAuthenticated) router.replace('/login');
  }, [initialized, isAuthenticated, router]);
  useEffect(() => {
    if (profile) {
      setForm(p => ({
        ...p,
        business_name: profile.business_name || p.business_name,
        industry: profile.industry || p.industry,
        currency: profile.currency || p.currency,
        location: profile.location || p.location,
      }));
    }
  }, [profile]);

  const sym = CURRENCIES.find(c => c.code === form.currency)?.symbol ?? 'K';
  const canNext = step !== 0 || form.business_name.trim().length > 0;

  async function finish() {
    setError(null); setSaving(true);
    try {
      await updateProfile({
        business_name: form.business_name.trim(),
        industry: form.industry || null,
        currency: form.currency,
        location: form.location || null,
        tax_status: form.tax_status,
        employees: form.employees ? Number(form.employees) : null,
        operating_hours: form.operating_hours || null,
        language: form.language,
        onboarded_at: new Date().toISOString(),
      });
      const cash = parseFloat(form.initial_cash);
      await seedTwin(isNaN(cash) ? 0 : cash, form.currency).catch(() => {});
      setCurrency(sym);
      router.push('/dashboard/record');
    } catch (e) {
      setError((e as Error).message || 'Could not complete setup.');
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          Set up your business
        </h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-3)', margin: '0 0 24px' }}>
          A few essentials — everything else you can add later.
        </p>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 99, background: i <= step ? 'var(--cyan)' : 'var(--border)' }} />
              <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: i === step ? 'var(--cyan)' : 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s}</div>
            </div>
          ))}
        </div>

        <div className="section-card" style={{ padding: 24 }}>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              {step === 0 && (
                <>
                  <div style={fieldGap}>
                    <label style={labelStyle}>Business name *</label>
                    <input autoFocus value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="e.g. Mwansa General Dealers" style={inputStyle} />
                  </div>
                  <div style={fieldGap}>
                    <label style={labelStyle}>Industry</label>
                    <select value={form.industry} onChange={e => set('industry', e.target.value)} style={inputStyle}>
                      <option value="">Select…</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div style={fieldGap}>
                    <label style={labelStyle}>Location</label>
                    <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Lusaka" style={inputStyle} />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div style={fieldGap}>
                    <label style={labelStyle}>Currency</label>
                    <select value={form.currency} onChange={e => set('currency', e.target.value)} style={inputStyle}>
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                  <div style={fieldGap}>
                    <label style={labelStyle}>Cash on hand today</label>
                    <input type="number" inputMode="decimal" value={form.initial_cash} onChange={e => set('initial_cash', e.target.value)} placeholder={`${sym} 0.00`} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }} />
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', color: 'var(--text-4)', marginTop: 6 }}>
                      Your starting balance — every event you record adjusts it from here.
                    </p>
                  </div>
                  <div style={fieldGap}>
                    <label style={labelStyle}>Tax status</label>
                    <select value={form.tax_status} onChange={e => set('tax_status', e.target.value)} style={inputStyle}>
                      {TAX.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div style={fieldGap}>
                    <label style={labelStyle}>Number of employees</label>
                    <input type="number" inputMode="numeric" value={form.employees} onChange={e => set('employees', e.target.value)} placeholder="e.g. 4" style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }} />
                  </div>
                  <div style={fieldGap}>
                    <label style={labelStyle}>Operating hours</label>
                    <input value={form.operating_hours} onChange={e => set('operating_hours', e.target.value)} placeholder="e.g. 08:00 – 18:00" style={inputStyle} />
                  </div>
                  <div style={fieldGap}>
                    <label style={labelStyle}>Preferred language</label>
                    <select value={form.language} onChange={e => set('language', e.target.value)} style={inputStyle}>
                      {LANGUAGES.map(l => <option key={l.v} value={l.v}>{l.l}</option>)}
                    </select>
                  </div>
                </>
              )}

              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['Business', form.business_name || '—'],
                    ['Industry', form.industry || '—'],
                    ['Location', form.location || '—'],
                    ['Currency', form.currency],
                    ['Cash on hand', form.initial_cash ? `${sym}${form.initial_cash}` : `${sym}0`],
                    ['Tax status', TAX.find(t => t.v === form.tax_status)?.l ?? '—'],
                    ['Employees', form.employees || '—'],
                    ['Hours', form.operating_hours || '—'],
                    ['Language', LANGUAGES.find(l => l.v === form.language)?.l ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</span>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-1)', textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.82rem' }}>
              {error}
            </div>
          )}

          {/* Nav */}
          <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'space-between' }}>
            <button
              type="button" onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0 || saving} className="touch-target"
              style={{ padding: '12px 20px', minHeight: 48, borderRadius: 10, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? 0.4 : 1 }}
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button" onClick={() => setStep(s => s + 1)} disabled={!canNext} className="touch-target"
                style={{ padding: '12px 28px', minHeight: 48, borderRadius: 10, border: 'none', background: 'var(--cyan)', color: '#04121a', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 700, cursor: canNext ? 'pointer' : 'default', opacity: canNext ? 1 : 0.5 }}
              >
                Continue
              </button>
            ) : (
              <button
                type="button" onClick={finish} disabled={saving} className="touch-target"
                style={{ padding: '12px 28px', minHeight: 48, borderRadius: 10, border: 'none', background: 'var(--green)', color: '#04140d', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Setting up…' : 'Start using AIBOS'}
              </button>
            )}
          </div>
        </div>

        <button
          type="button" onClick={() => router.push('/dashboard/record')}
          style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', textDecoration: 'underline', display: 'block', marginInline: 'auto' }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
