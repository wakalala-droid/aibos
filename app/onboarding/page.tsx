'use client';
/**
 * AIBOS: Business Setup (Evolution Initiative 1).
 * Start a business on AIBOS with only a phone: a few essentials, everything else
 * optional. One screen since the UX audit (17 Nov 2026): name, industry and
 * cash on hand, the rest folded under "More about the business"; it used to
 * be four screens (Business, Money, Operations, Review) before any value.
 * Then one first thing to do, the first sale, with the other starts quiet
 * under it (six equal buttons made many owners pick none). "Initial cash" seeds the Digital Twin's opening balance; the rest
 * updates the profile. Mobile-first, one decision at a time (ux_intelligence.md
 * DECISION SIMPLIFICATION), every state handled.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, MessageSquare, CircleCheck, Package, BookOpen, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { updateProfile, seedTwin, createProduct, lookupBusinessIdentity, downloadWorkbook, type BusinessMatch } from '@/lib/api';
import { logUsage } from '@/lib/usage';
import { CURRENCIES } from '@/lib/currency';
import { starterProductsFor, industryOf } from '@/lib/industries';
import BusinessMatchCard from '@/components/onboarding/BusinessMatchCard';
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


const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', minHeight: 48,
  background: 'var(--bg-input)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)',
  color: 'var(--text-1)', fontSize: 'var(--fs-body)',
};
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--fs-caps)', fontWeight: 600,
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
  // First-win step (post-setup): seed a starter catalog so the owner never
  // lands on an empty product list (audit §10 fix #2).
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [gettingBook, setGettingBook] = useState(false);
  const [gotBook, setGotBook] = useState(false);

  const [form, setForm] = useState({
    business_name: '', industry: '', currency: 'ZMW',
    initial_cash: '', tax_status: 'unregistered',
    employees: '', operating_hours: '', location: '', language: 'en',
    // Filled only by an identity match — the wizard never asks for these, so
    // they cost the owner nothing and quietly brand their first invoice.
    phone: '', website: '', logo_url: '',
  });
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  // ── Identity match: "it already knew me" ──────────────────────────────────
  // Look the business up as they type, and offer what we find as one tap. All
  // of this is best-effort garnish: every path here can fail silently and the
  // wizard still works exactly as it did before.
  const [matches, setMatches] = useState<BusinessMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [appliedMatch, setAppliedMatch] = useState<BusinessMatch | null>(null);
  const [lookupOff, setLookupOff] = useState(false);   // "none of these": for this session
  // What the fields held before a match was applied, so Undo is exact rather
  // than a guess at which values were ours.
  const beforeMatch = useRef<Partial<typeof form> | null>(null);
  const lastQuery = useRef('');
  const lookups = useRef(0);
  // Hard session cap. Every miss is a paid Places call, and no honest owner
  // needs more than a handful of tries to type their own name.
  const LOOKUP_BUDGET = 6;

  useEffect(() => {
    const q = form.business_name.trim();
    if (lookupOff || appliedMatch || step !== 0 || q.length < 3) return;
    if (q.toLowerCase() === lastQuery.current) return;
    if (lookups.current >= LOOKUP_BUDGET) return;

    const controller = new AbortController();
    // Fire on a PAUSE in typing, never per keystroke — this is the difference
    // between ~1 lookup per signup and ~15.
    const timer = setTimeout(async () => {
      lastQuery.current = q.toLowerCase();
      lookups.current += 1;
      setSearching(true);
      const { configured, candidates } = await lookupBusinessIdentity(q, {
        phone: profile?.phone ?? undefined,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setSearching(false);
      setMatches(candidates);
      // Only claim "we found nothing" when a lookup actually ran. With no
      // provider configured the feature stays invisible instead of apologising.
      setSearched(configured);
    }, 700);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.business_name, step, lookupOff, appliedMatch, profile?.phone]);

  const applyMatch = useCallback((m: BusinessMatch) => {
    setForm(p => {
      beforeMatch.current = {
        business_name: p.business_name, industry: p.industry, location: p.location,
        operating_hours: p.operating_hours, phone: p.phone, website: p.website,
        logo_url: p.logo_url,
      };
      // Their own typing wins over anything imported: a field they already
      // filled is never overwritten by a listing.
      return {
        ...p,
        business_name:  m.business_name || p.business_name,
        industry:       p.industry || m.industry,
        location:       p.location || m.location,
        operating_hours: p.operating_hours || m.operating_hours,
        phone:          p.phone || m.phone,
        website:        p.website || m.website,
        logo_url:       p.logo_url || m.logo_url,
      };
    });
    setAppliedMatch(m);
    setMatches([]);
    logUsage('identity_match_applied');
  }, []);

  const undoMatch = useCallback(() => {
    if (beforeMatch.current) setForm(p => ({ ...p, ...beforeMatch.current }));
    beforeMatch.current = null;
    setAppliedMatch(null);
    // Don't immediately re-offer what they just rejected.
    setLookupOff(true);
  }, []);

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
        phone: profile.phone || p.phone,
        logo_url: profile.logo_url || p.logo_url,
      }));
    }
  }, [profile]);

  const sym = CURRENCIES.find(c => c.code === form.currency)?.symbol ?? 'K';
  const canFinish = form.business_name.trim().length > 0;

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
        // From an identity match (or left untouched if there wasn't one).
        phone: form.phone || null,
        website: form.website || null,
        logo_url: form.logo_url || null,
        // Provenance (migration 0026): these details came from outside AIBOS and
        // a human confirmed them. Recorded so nothing downstream mistakes an
        // accepted suggestion for something AIBOS observed.
        identity_place_id: appliedMatch?.place_id || null,
        identity_source: appliedMatch?.source || null,
        identity_confirmed_at: appliedMatch ? new Date().toISOString() : null,
      });
      logUsage('onboarding_completed');
      // The starting cash is asked for here and nowhere else, so a failure
      // cannot be swallowed: it used to vanish and every balance after it was
      // wrong by that amount. The profile save above is safe to repeat, so the
      // owner can press the button again. A blank field sets the currency and
      // leaves any cash already recorded alone instead of zeroing it.
      const raw = form.initial_cash.trim();
      const cash = raw === '' ? null : parseFloat(raw);
      try {
        await seedTwin(cash !== null && !isNaN(cash) ? cash : null, form.currency);
      } catch (e) {
        throw new Error(`Your details are saved, but your starting cash was not: ${(e as Error).message || 'the server did not answer'}. Press the button again to retry.`);
      }
      // 'auto': this seeds the starting symbol but keeps uploads authoritative —
      // only the universal selector (header) pins a manual override.
      setCurrency(sym, 'auto');
      // Don't dump them on an empty dashboard (audit §10): advance to a
      // first-win step where they get real numbers in the first minute.
      setSaving(false);
      setStep(4);
    } catch (e) {
      setError((e as Error).message || 'Could not complete setup.');
      setSaving(false);
    }
  }

  async function seedStarters() {
    setSeeding(true); setError(null);
    try {
      const starters = starterProductsFor(form.industry, form.industry);
      for (const s of starters) {
        await createProduct({ name: s.name, category: s.category, unit: s.unit, buy_price: 0, sell_price: 0, opening_stock: 0, reorder_level: 0, supplier: '' });
      }
      setSeeded(true);
    } catch (e) { setError((e as Error).message || 'Could not add starter products.'); }
    finally { setSeeding(false); }
  }

  // The AIBOS workbook: a spreadsheet already laid out the way AIBOS reads,
  // for an owner whose history lives on paper or nowhere yet.
  async function getWorkbook() {
    setGettingBook(true); setError(null);
    try { await downloadWorkbook(); setGotBook(true); logUsage('workbook_downloaded'); }
    catch (e) { setError((e as Error).message || 'Could not make your workbook.'); }
    finally { setGettingBook(false); }
  }

  const quietRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 4px', minHeight: 56,
    border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-1)',
  };
  const quietIcon = (done?: boolean): React.CSSProperties => ({ display: 'inline-flex', color: done ? 'var(--good)' : 'var(--text-3)', flexShrink: 0 });
  const quietTitle: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)' };
  const quietSub: React.CSSProperties = { fontSize: 'var(--fs-label)', color: 'var(--text-3)' };
  const errorBox = error && (
    <div role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-body)' }}>
      {error}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          {step === 4 ? 'Your business is set up' : 'Set up your business'}
        </h1>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 24px' }}>
          {step === 4 ? 'Now the first thing that makes AIBOS useful.' : 'Three things and you are in. Everything else can wait.'}
        </p>

        <div className="section-card" style={{ padding: 24 }}>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              {step !== 4 && (
                <form onSubmit={(e) => { e.preventDefault(); if (canFinish && !saving) void finish(); }}>
                  <div style={fieldGap}>
                    <label htmlFor="ob-name" style={labelStyle}>Business name *</label>
                    <input id="ob-name" autoFocus value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="e.g. Mwansa General Dealers" style={inputStyle} />
                  </div>

                  {/* If they already have an online presence, offer it back as
                      one tap. Renders nothing when there's nothing to offer. */}
                  <BusinessMatchCard
                    matches={matches}
                    searching={searching}
                    searched={searched}
                    query={form.business_name}
                    applied={appliedMatch}
                    onApply={applyMatch}
                    onUndo={undoMatch}
                    onDismiss={() => { setMatches([]); setSearched(false); setLookupOff(true); }}
                  />

                  <div style={fieldGap}>
                    <label htmlFor="ob-industry" style={labelStyle}>Industry</label>
                    <select id="ob-industry" value={form.industry} onChange={e => set('industry', e.target.value)} style={inputStyle}>
                      <option value="">Select…</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div style={fieldGap}>
                    <label htmlFor="ob-cash" style={labelStyle}>Cash on hand today</label>
                    <input id="ob-cash" type="number" inputMode="decimal" value={form.initial_cash} onChange={e => set('initial_cash', e.target.value)} placeholder={`${sym} 0.00`} style={{ ...inputStyle }} />
                    <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-4)', marginTop: 6 }}>
                      Your starting balance: every entry you record adjusts it from here.
                    </p>
                  </div>

                  <details style={{ marginBottom: 8 }}>
                    <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)' }}>
                      More about the business (optional)
                    </summary>
                    <div style={{ paddingTop: 12 }}>
                      <div style={fieldGap}>
                        <label htmlFor="ob-location" style={labelStyle}>Location</label>
                        <input id="ob-location" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Lusaka" style={inputStyle} />
                      </div>
                      <div style={fieldGap}>
                        <label htmlFor="ob-currency" style={labelStyle}>Currency</label>
                        <select id="ob-currency" value={form.currency} onChange={e => set('currency', e.target.value)} style={inputStyle}>
                          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{`${c.name} (${c.symbol})`}</option>)}
                        </select>
                      </div>
                      <div style={fieldGap}>
                        <label htmlFor="ob-tax" style={labelStyle}>Tax status</label>
                        <select id="ob-tax" value={form.tax_status} onChange={e => set('tax_status', e.target.value)} style={inputStyle}>
                          {TAX.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                        </select>
                      </div>
                      <div style={fieldGap}>
                        <label htmlFor="ob-employees" style={labelStyle}>Number of employees</label>
                        <input id="ob-employees" type="number" inputMode="numeric" value={form.employees} onChange={e => set('employees', e.target.value)} placeholder="e.g. 4" style={{ ...inputStyle }} />
                      </div>
                      <div style={fieldGap}>
                        <label htmlFor="ob-hours" style={labelStyle}>Operating hours</label>
                        <input id="ob-hours" value={form.operating_hours} onChange={e => set('operating_hours', e.target.value)} placeholder="e.g. 08:00 to 18:00" style={inputStyle} />
                      </div>
                      <div style={fieldGap}>
                        <label htmlFor="ob-language" style={labelStyle}>Preferred language</label>
                        <select id="ob-language" value={form.language} onChange={e => set('language', e.target.value)} style={inputStyle}>
                          {LANGUAGES.map(l => <option key={l.v} value={l.v}>{l.l}</option>)}
                        </select>
                      </div>
                    </div>
                  </details>

                  {errorBox}

                  <button type="submit" disabled={!canFinish || saving} className="touch-target"
                    style={{ marginTop: 16, width: '100%', padding: '12px 28px', minHeight: 48, borderRadius: 10, border: 'none', background: 'var(--brand-fill)', color: 'var(--on-brand)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: canFinish && !saving ? 'pointer' : 'default', opacity: canFinish && !saving ? 1 : 0.5 }}>
                    {saving ? 'Setting up…' : 'Start using AIBOS'}
                  </button>
                </form>
              )}

              {step === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* The one first thing: a real sale, typed or said. */}
                  <button type="button" onClick={() => router.push('/dashboard/record')} className="touch-target"
                    style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--cyan)', background: 'var(--cyan-dim)', cursor: 'pointer' }}>
                    <span aria-hidden style={{ display: 'inline-flex', color: 'var(--cyan)' }}><MessageSquare size={28} strokeWidth={2} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)' }}>Tell AIBOS your last sale</span>
                      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>Type it or say it, the way you would tell a friend: “{industryOf(form.industry, form.industry).saleExample}”</span>
                    </span>
                  </button>
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '10px 0 20px' }}>
                    Record on 3 different days and the one thing to do each day shows on Home, free for 14 days.
                  </p>

                  <p className="eyebrow" style={{ margin: '0 0 4px' }}>Or start another way</p>
                  <button type="button" onClick={() => router.push('/dashboard/record?receipt=1')} style={quietRow}>
                    <span aria-hidden style={quietIcon()}><Camera size={22} strokeWidth={2} /></span>
                    <span><span style={quietTitle}>Scan your last receipt</span><span style={quietSub}>Photograph it: AIBOS reads it and records the purchase.</span></span>
                  </button>
                  <button type="button" onClick={() => router.push('/dashboard/teach')} style={quietRow}>
                    <span aria-hidden style={quietIcon()}><BookOpen size={22} strokeWidth={2} /></span>
                    <span><span style={quietTitle}>Teach AIBOS your business</span><span style={quietSub}>About five minutes of questions: your story, a normal month and your goals.</span></span>
                  </button>
                  <button type="button" onClick={() => void seedStarters()} disabled={seeding || seeded} style={{ ...quietRow, cursor: seeded ? 'default' : 'pointer' }}>
                    <span aria-hidden style={quietIcon(seeded)}>{seeded ? <CircleCheck size={22} strokeWidth={2} /> : <Package size={22} strokeWidth={2} />}</span>
                    <span>
                      <span style={quietTitle}>{seeded ? 'Starter products added' : seeding ? 'Adding…' : `Add starter products for your ${industryOf(form.industry, form.industry).label}`}</span>
                      <span style={quietSub}>{seeded ? 'Edit prices and stock any time on the Stock page.' : 'A ready-made list you can edit: no blank page.'}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => void getWorkbook()} disabled={gettingBook} style={{ ...quietRow, cursor: gettingBook ? 'default' : 'pointer' }}>
                    <span aria-hidden style={quietIcon(gotBook)}>{gotBook ? <CircleCheck size={22} strokeWidth={2} /> : <FileSpreadsheet size={22} strokeWidth={2} />}</span>
                    <span>
                      <span style={quietTitle}>{gotBook ? 'Your AIBOS workbook is downloaded' : gettingBook ? 'Making your workbook…' : 'Get your AIBOS workbook'}</span>
                      <span style={quietSub}>{gotBook ? 'Fill it in, then upload it on the Upload a file page.' : 'A spreadsheet laid out the way AIBOS reads: fill it in and upload it.'}</span>
                    </span>
                  </button>

                  {errorBox}

                  <button type="button" onClick={() => router.push('/dashboard')} className="touch-target"
                    style={{ marginTop: 16, padding: '12px 20px', minHeight: 48, borderRadius: 10, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>
                    Go to Home
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {step !== 4 && (
          <button
            type="button" onClick={() => router.push('/dashboard/record')}
            style={{ marginTop: 16, minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 'var(--fs-label)', textDecoration: 'underline', display: 'block', marginInline: 'auto' }}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
