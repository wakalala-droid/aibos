'use client';
/**
 * AIBOS — what the law asks of this payroll that is not done yet.
 *
 * The register can look complete while a contract earns no gratuity, a
 * contract has ended with its gratuity unpaid, or the numbers ZRA's, NAPSA's
 * and NHIMA's monthly returns list each person by are missing. The server
 * (aibos-api payroll.statutory_checks) works each out with its section of the
 * law; this lists them most urgent first and takes the employer's own numbers
 * (TPIN, NAPSA account, NHIMA number), which head every return and every
 * leaver's certificate of service.
 */
import { useEffect, useState } from 'react';
import { Section, Note } from '@/components/hospitality/kit';
import { setPayrollEmployer, type PayrollCheck, type PayrollEmployer } from '@/lib/api';

const TONE: Record<PayrollCheck['level'], 'bad' | 'warn' | 'info'> = { act: 'bad', warn: 'warn', info: 'info' };

export default function PayrollChecks({ checks, employer, onChange, onEdit, loading }: {
  checks: PayrollCheck[];
  employer: PayrollEmployer;
  onChange: () => void;
  /** Open this person's details to put a check right. */
  onEdit: (employeeId: string) => void;
  loading?: boolean;
}) {
  const [numbers, setNumbers] = useState<PayrollEmployer>(employer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setNumbers(employer); }, [employer]);

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    try {
      await setPayrollEmployer({
        tpin: numbers.tpin?.trim() || null, napsa: numbers.napsa?.trim() || null, nhima: numbers.nhima?.trim() || null,
        address: numbers.address?.trim() || null,
      });
      setSaved(true);
      onChange();
    } catch (e) { setError((e as Error).message || 'Could not save your numbers.'); }
    finally { setSaving(false); }
  }

  // The money owed and the returns first; the "worth adding" ones behind a tap.
  const urgent = checks.filter(c => c.level !== 'info');
  const shown = showAll ? checks : urgent.length ? urgent : checks.slice(0, 3);
  const hidden = checks.length - shown.length;

  return (
    <>
      <Section title="What the law asks">
        {loading ? (
          <div className="skeleton" style={{ height: 64 }} />
        ) : checks.length === 0 ? (
          <Note tone="good">Everything the law asks of this payroll is in place: gratuity, contracts and the numbers every return needs.</Note>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map((c, i) => (
              <Note key={`${c.employee_id ?? 'biz'}-${i}`} tone={TONE[c.level]}>
                {c.text}
                {c.employee_id && (
                  <div style={{ marginTop: 6 }}>
                    <button type="button" className="pill pill-quiet" onClick={() => onEdit(c.employee_id!)}>
                      Change {c.name?.split(/\s+/)[0] ?? 'them'}
                    </button>
                  </div>
                )}
              </Note>
            ))}
            {hidden > 0 && (
              <button type="button" className="pill pill-quiet" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(true)}>
                {hidden} more worth adding
              </button>
            )}
          </div>
        )}
      </Section>

      <Section title="Your employer numbers">
        <p className="rs-text" style={{ margin: '0 0 12px', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
          They head the tax pack, every payslip and every leaver&rsquo;s certificate of service.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div><label className="field-label" htmlFor="er-tpin">TPIN</label>
            <input id="er-tpin" className="field" inputMode="numeric" value={numbers.tpin ?? ''} onChange={e => setNumbers(n => ({ ...n, tpin: e.target.value }))} /></div>
          <div><label className="field-label" htmlFor="er-napsa">NAPSA account number</label>
            <input id="er-napsa" className="field" value={numbers.napsa ?? ''} onChange={e => setNumbers(n => ({ ...n, napsa: e.target.value }))} /></div>
          <div><label className="field-label" htmlFor="er-nhima">NHIMA number</label>
            <input id="er-nhima" className="field" value={numbers.nhima ?? ''} onChange={e => setNumbers(n => ({ ...n, nhima: e.target.value }))} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label className="field-label" htmlFor="er-address">Business address (on every payslip)</label>
            <input id="er-address" className="field" value={numbers.address ?? ''} placeholder="Plot 12, Cairo Road, Lusaka"
              onChange={e => setNumbers(n => ({ ...n, address: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="pill" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save the numbers'}</button>
          {saved && <span style={{ fontSize: 'var(--fs-label)', color: 'var(--green)' }}>Saved.</span>}
        </div>
        {error && <Note tone="bad">{error}</Note>}
      </Section>
    </>
  );
}
