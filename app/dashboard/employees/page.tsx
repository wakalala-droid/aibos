'use client';
/**
 * AI-BOS — Employees & Payroll.
 * The company's people (a free register — master data, like the product catalog)
 * and a Zambian statutory payroll engine (Pro). Running a period computes PAYE,
 * NAPSA, NHIMA and net pay for each active employee, decrements staff loans, and
 * posts one confirmed Salary business-event per person — so payroll and the
 * P&L/cashflow stay one story (the same record bridge the Scheduler uses).
 *
 * Rates are AIBOS-maintained and effective-dated server-side: the owner never
 * touches tax tables — they add people and press Run.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SectionCard from '@/components/ui/SectionCard';
import { useStore } from '@/lib/store';
import { canAccess, requiredTier, TIERS } from '@/lib/tiers';
import PageHeader from '@/components/ui/PageHeader';
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  previewPayroll, runPayroll, listPayrollRuns, getPayrollRates,
  type Employee, type EmployeeInput, type EmploymentType,
  type PayrollPreview, type PayrollRun, type PayrollRates, type RemittanceDraft,
} from '@/lib/api';

// ── Shared field styles (mirrors the Scheduler's form vocabulary) ────────────
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontSize: 'var(--fs-body)', outline: 'none',
};
const lbl: React.CSSProperties = { fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' };
const ghostBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-label)' };
const th: React.CSSProperties = { fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', padding: '4px 6px', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { fontSize: 'var(--fs-data)', color: 'var(--text-2)', textAlign: 'right', padding: '6px', whiteSpace: 'nowrap' };

interface FormState {
  name: string; position: string; employment_type: EmploymentType;
  basic_pay: string; pay_day: string; gratuity_eligible: boolean; gratuity_rate: string;
  loan_balance: string; loan_monthly: string; napsa_number: string; tpin: string; notes: string;
}
const EMPTY: FormState = {
  name: '', position: '', employment_type: 'permanent',
  basic_pay: '', pay_day: '28', gratuity_eligible: false, gratuity_rate: '25',
  loan_balance: '', loan_monthly: '', napsa_number: '', tpin: '', notes: '',
};

const thisPeriod = () => new Date().toISOString().slice(0, 7);         // 'YYYY-MM'
const fmtDue = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });

export default function EmployeesPage() {
  const sym = useStore(s => s.currencySymbol) || 'K';
  const tier = useStore(s => s.tier);
  const pro = canAccess(tier, 'payroll');
  const needTier = TIERS[requiredTier('payroll')].name;

  // Full-precision money (payroll needs the cents PAYE/NAPSA produce).
  const money = (v: number | null | undefined) =>
    `${sym}${(v ?? 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [rates, setRates] = useState<PayrollRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [period, setPeriod] = useState(thisPeriod());
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runOk, setRunOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [emps, rs, rt] = await Promise.all([listEmployees(), listPayrollRuns(), getPayrollRates()]);
      setEmployees(emps); setRuns(rs); setRates(rt);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  function editEmployee(e: Employee) {
    setEditId(e.id); setMoreOpen(true);
    setForm({
      name: e.name, position: e.position ?? '', employment_type: e.employment_type,
      basic_pay: String(e.basic_pay ?? ''), pay_day: String(e.pay_day ?? 28),
      gratuity_eligible: e.gratuity_eligible, gratuity_rate: String(Math.round((e.gratuity_rate ?? 0.25) * 100)),
      loan_balance: e.loan_balance ? String(e.loan_balance) : '',
      loan_monthly: e.loan_monthly ? String(e.loan_monthly) : '',
      napsa_number: e.napsa_number ?? '', tpin: e.tpin ?? '', notes: e.notes ?? '',
    });
  }
  function cancelEdit() { setEditId(null); setForm(EMPTY); setMoreOpen(false); }

  async function saveEmployee() {
    if (!form.name.trim()) { setError('Give the employee a name.'); return; }
    setSaving(true); setError(null);
    try {
      const body: EmployeeInput = {
        name: form.name.trim(),
        position: form.position.trim() || null,
        employment_type: form.employment_type,
        basic_pay: form.basic_pay ? Number(form.basic_pay) : 0,
        pay_day: Number(form.pay_day) || 28,
        gratuity_eligible: form.employment_type === 'contract' && form.gratuity_eligible,
        gratuity_rate: form.gratuity_rate ? Number(form.gratuity_rate) / 100 : 0.25,
        loan_balance: form.loan_balance ? Number(form.loan_balance) : 0,
        loan_monthly: form.loan_monthly ? Number(form.loan_monthly) : 0,
        napsa_number: form.napsa_number.trim() || null,
        tpin: form.tpin.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editId) await updateEmployee(editId, body);
      else await createEmployee(body);
      cancelEdit(); setPreview(null); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function removeEmployee(id: string) {
    try { await deleteEmployee(id); if (editId === id) cancelEdit(); setPreview(null); await load(); }
    catch (e) { setError((e as Error).message); }
  }

  async function doPreview() {
    setBusy(true); setRunError(null); setRunOk(null);
    try { setPreview(await previewPayroll(period)); }
    catch (e) { setRunError((e as Error).message); setPreview(null); }
    finally { setBusy(false); }
  }

  async function doRun() {
    setBusy(true); setRunError(null); setRunOk(null);
    try {
      const run = await runPayroll(period);
      const rem = (run.remittances ?? []).filter(r => r.amount > 0);
      const remLine = rem.length
        ? ` ${rem.map(r => `${r.tax_type} ${money(r.amount)}`).join(', ')} drafted as pending remittances${rem[0]?.due_date ? ` (due ${fmtDue(rem[0].due_date)})` : ''}.`
        : '';
      setRunOk(`Payroll for ${period} run — ${run.totals.headcount} paid, ${money(run.totals.net)} net paid to staff.${remLine}`);
      setPreview(null); await load();
    } catch (e) { setRunError((e as Error).message); }
    finally { setBusy(false); }
  }

  const active = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const alreadyRun = useMemo(() => runs.some(r => r.period === period), [runs, period]);

  return (
    <>
      <PageHeader
        title="Employees & Payroll"
        subtitle="Your people, their pay — PAYE, NAPSA and net pay worked out for you."
      />

      <div className="grid-main">
        {/* ── People (register — free) ─────────────────────────────────────── */}
        <SectionCard title="Your people" explainId="employees.register"
          subtitle={loading ? 'Loading…' : `${active.length} active${employees.length > active.length ? ` · ${employees.length - active.length} left` : ''}`}>
          {error && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-data)' }}>{error}</div>}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}</div>
          ) : employees.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '4px 0 0' }}>
              No employees yet. Add your first person below — name and monthly pay is enough to start.
            </p>
          ) : (
            <div>
              {employees.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', opacity: e.status === 'left' ? 0.5 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.name}
                      {e.position && <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> · {e.position}</span>}
                    </div>
                    <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>
                      {money(e.basic_pay)}/mo · paid {e.pay_day}{e.pay_day === 1 ? 'st' : 'th'}
                      {e.employment_type === 'contract' ? ' · contract' : ''}
                      {e.gratuity_eligible ? ` · gratuity ${Math.round(e.gratuity_rate * 100)}%` : ''}
                      {e.loan_balance > 0 ? ` · loan ${money(e.loan_balance)}` : ''}
                    </div>
                  </div>
                  <button type="button" onClick={() => editEmployee(e)} style={{ ...ghostBtn, color: 'var(--cyan)' }}>Edit</button>
                  <button type="button" onClick={() => removeEmployee(e.id)} style={{ ...ghostBtn, color: 'var(--text-4)' }}>Delete</button>
                </div>
              ))}
            </div>
          )}

          {/* Add / edit form */}
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>
              {editId ? 'Edit employee' : 'Add employee'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Grace Banda" style={input} /></div>
              <div><label style={lbl}>Role</label><input value={form.position} onChange={e => set('position', e.target.value)} placeholder="Cashier" style={input} /></div>
              <div><label style={lbl}>Monthly pay ({sym})</label><input type="number" min="0" value={form.basic_pay} onChange={e => set('basic_pay', e.target.value)} placeholder="8000" style={input} /></div>
              <div>
                <label style={lbl}>Type</label>
                <select value={form.employment_type} onChange={e => set('employment_type', e.target.value as EmploymentType)} style={input}>
                  <option value="permanent">Permanent</option>
                  <option value="contract">Fixed-term contract</option>
                </select>
              </div>
              <div><label style={lbl}>Pay day</label><input type="number" min="1" max="28" value={form.pay_day} onChange={e => set('pay_day', e.target.value)} style={input} /></div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => setMoreOpen(o => !o)} style={{ ...ghostBtn, color: 'var(--cyan)', fontSize: 'var(--fs-label)' }}>
                  {moreOpen ? 'Fewer options' : 'Loan, gratuity & IDs'}
                </button>
              </div>

              {moreOpen && (
                <>
                  <div><label style={lbl}>Staff loan balance ({sym})</label><input type="number" min="0" value={form.loan_balance} onChange={e => set('loan_balance', e.target.value)} placeholder="0" style={input} /></div>
                  <div><label style={lbl}>Deduct per month ({sym})</label><input type="number" min="0" value={form.loan_monthly} onChange={e => set('loan_monthly', e.target.value)} placeholder="0" style={input} /></div>
                  {form.employment_type === 'contract' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'end', paddingBottom: 8 }}>
                        <input id="emp-grat" type="checkbox" checked={form.gratuity_eligible} onChange={e => set('gratuity_eligible', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--cyan)' }} />
                        <label htmlFor="emp-grat" style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', cursor: 'pointer' }}>Accrues gratuity</label>
                      </div>
                      <div><label style={lbl}>Gratuity rate (%)</label><input type="number" min="25" value={form.gratuity_rate} onChange={e => set('gratuity_rate', e.target.value)} disabled={!form.gratuity_eligible} style={{ ...input, opacity: form.gratuity_eligible ? 1 : 0.5 }} /></div>
                    </>
                  )}
                  <div><label style={lbl}>NAPSA number</label><input value={form.napsa_number} onChange={e => set('napsa_number', e.target.value)} style={input} /></div>
                  <div><label style={lbl}>TPIN</label><input value={form.tpin} onChange={e => set('tpin', e.target.value)} style={input} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} style={input} /></div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={saveEmployee} disabled={saving} className="touch-target"
                style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--green)', color: '#04140d', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Add employee'}
              </button>
              {editId && <button type="button" onClick={cancelEdit} className="touch-target" style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>}
            </div>
          </div>
        </SectionCard>

        {/* ── Run payroll ──────────────────────────────────────────────────── */}
        <SectionCard title="Run payroll" explainId="payroll.run"
          subtitle="Preview is free. Running posts each salary to your books."
          action={pro ? undefined : (
            <span className="badge" style={{ background: 'color-mix(in srgb, var(--cyan) 12%, transparent)', color: 'var(--cyan)' }}>{needTier}</span>
          )}>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <label style={lbl}>Pay period</label>
              <input type="month" value={period} onChange={e => { setPeriod(e.target.value); setPreview(null); setRunOk(null); setRunError(null); }} style={{ ...input, width: 'auto' }} />
            </div>
            <button type="button" onClick={doPreview} disabled={busy || active.length === 0} className="touch-target"
              style={{ padding: '9px 16px', minHeight: 40, borderRadius: 8, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-1)', fontSize: 'var(--fs-data)', fontWeight: 700, cursor: 'pointer', opacity: (busy || active.length === 0) ? 0.6 : 1 }}>
              {busy ? 'Computing…' : 'Preview'}
            </button>
          </div>

          {active.length === 0 && (
            <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-4)' }}>Add an employee first, then preview a period.</p>
          )}
          {runError && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-data)' }}>{runError}</div>}
          {runOk && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'color-mix(in srgb, var(--green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 40%, transparent)', color: 'var(--green)', fontSize: 'var(--fs-data)' }}>{runOk}</div>}

          {/* Preview table */}
          {preview && preview.payslips.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>Employee</th>
                    <th style={th}>Gross</th><th style={th}>NAPSA</th><th style={th}>NHIMA</th>
                    <th style={th}>PAYE</th><th style={th}>Loan</th><th style={{ ...th, color: 'var(--text-2)' }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.payslips.map((s, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, textAlign: 'left', color: 'var(--text-1)', fontWeight: 600 }}>{s.employee_name}</td>
                      <td style={td}>{money(s.gross)}</td>
                      <td style={td}>{money(s.napsa_employee)}</td>
                      <td style={td}>{money(s.nhima_employee)}</td>
                      <td style={td}>{money(s.paye)}</td>
                      <td style={td}>{money(s.loan_deduction)}</td>
                      <td style={{ ...td, color: 'var(--text-1)', fontWeight: 700 }}>{money(s.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-md)' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: 'var(--text-2)' }}>Total · {preview.totals.headcount}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.gross)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.napsa_employee)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.nhima_employee)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.paye)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.loan_deduction)}</td>
                    <td style={{ ...td, fontWeight: 800, color: 'var(--text-1)' }}>{money(preview.totals.net)}</td>
                  </tr>
                </tfoot>
              </table>

              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {alreadyRun ? (
                  <span style={{ fontSize: 'var(--fs-data)', color: 'var(--amber)' }}>Payroll for {period} has already been run.</span>
                ) : pro ? (
                  <button type="button" onClick={doRun} disabled={busy} className="touch-target"
                    style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--green)', color: '#04140d', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
                    {busy ? 'Running…' : `Run payroll & post to books`}
                  </button>
                ) : (
                  <Link href="/pricing" style={{ padding: '10px 20px', minHeight: 44, display: 'inline-flex', alignItems: 'center', borderRadius: 10, background: 'var(--cyan)', color: '#fff', fontSize: 'var(--fs-body)', fontWeight: 700, textDecoration: 'none' }}>
                    Unlock payroll — upgrade to {needTier}
                  </Link>
                )}
                {preview.payslips.some(s => s.gratuity_accrued > 0) && (
                  <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>
                    + {money(preview.totals.gratuity_accrued)} gratuity accrued (employer cost)
                  </span>
                )}
              </div>

              {/* Statutory remittances that running will draft (pending, due next month). */}
              {preview.remittances.length > 0 && (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--border-md)', background: 'var(--bg-badge)' }}>
                  <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                    Also drafted for you{preview.remittances[0]?.due_date ? ` · due ${fmtDue(preview.remittances[0].due_date)}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {preview.remittances.map((r: RemittanceDraft) => (
                      <span key={r.tax_type} style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--text-4)' }}>{r.tax_type} → {r.authority}: </span>
                        <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{money(r.amount)}</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', marginTop: 6 }}>
                    Posted as pending payments — confirm each when you pay ZRA / NAPSA / NHIMA.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Past runs */}
          {runs.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', marginBottom: 4 }}>Past runs</div>
              {runs.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-1)' }}>
                    {r.period} <span style={{ color: 'var(--text-4)', fontWeight: 500 }}>· {r.totals.headcount} paid</span>
                  </span>
                  <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)' }}>{money(r.totals.net)} net</span>
                </div>
              ))}
            </div>
          )}

          {/* Rate transparency — AIBOS-maintained, the owner never edits these. */}
          {rates && (
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', marginTop: 12, lineHeight: 1.5 }}>
              Using {rates.currency} statutory rates effective {rates.effective_from}: NAPSA {Math.round(rates.napsa_rate * 100)}% (ceiling {money(rates.napsa_ceiling)}), NHIMA {Math.round(rates.nhima_rate * 100)}%, PAYE up to {Math.round((rates.paye_bands.at(-1)?.rate ?? 0) * 100)}%. Kept current for you — no tax tables to manage.
            </p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
