'use client';
/**
 * AIBOS — Import history from a spreadsheet.
 *
 * The old screen read ONE sheet and assumed row 1 held the headings. A
 * fifteen-sheet workbook came back as twenty-six columns called "Unnamed: 0"
 * with no amount and no date, and the other fourteen sheets were thrown away
 * without a word.
 *
 * This screen reads the WHOLE file. It shows every sheet it found, says what
 * each table on them is, and files each row against the worker, product or
 * expense category it actually concerns. Where it cannot know — a wage paid to
 * somebody not on the worker list — it ASKS, once, instead of guessing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import PageHeader from '@/components/ui/PageHeader';
import {
  documentScan, documentImport, listEmployees, listProducts, AlreadyImportedError,
  type DocScan, type DocTable, type DocQuestion, type DocAnswer, type DocImportResult,
  type EventType, type Employee, type Product,
} from '@/lib/api';

const TYPES: EventType[] = [
  'Sale', 'Purchase', 'Expense', 'InventoryReceipt', 'InventoryAdjustment',
  'Salary', 'SupplierPayment', 'CustomerPayment', 'AssetPurchase',
  'TaxPayment', 'Loan', 'Refund', 'Transfer',
];

const sel: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontSize: 'var(--fs-body)', outline: 'none',
};
const primaryBtn: React.CSSProperties = {
  padding: '10px 20px', minHeight: 44, borderRadius: 10, border: 'none',
  background: 'var(--green)', color: '#04140d', fontSize: 'var(--fs-body)',
  fontWeight: 700, cursor: 'pointer',
};
const quietBtn: React.CSSProperties = {
  padding: '10px 20px', minHeight: 44, borderRadius: 10, border: '1px solid var(--border-md)',
  background: 'transparent', color: 'var(--text-2)', fontSize: 'var(--fs-body)',
  fontWeight: 600, cursor: 'pointer',
};
const chip = (on: boolean): React.CSSProperties => ({
  padding: '8px 14px', minHeight: 40, borderRadius: 8, cursor: 'pointer',
  border: on ? '1px solid var(--cyan)' : '1px solid var(--border-md)',
  background: on ? 'var(--cyan)' : 'transparent',
  color: on ? '#04121a' : 'var(--text-2)',
  fontSize: 'var(--fs-body)', fontWeight: on ? 700 : 600,
});
const noteBox: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 10, border: '1px solid var(--amber)',
  background: 'var(--amber-dim, rgba(251,191,36,0.12))', color: 'var(--text-1)',
  fontSize: 'var(--fs-body)', lineHeight: 1.5,
};
const label: React.CSSProperties = {
  fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block',
};

/** "Mary Banda's wages" reads better than "wages: 6". */
function describeCounts(counts?: Record<string, number>): string {
  if (!counts) return '';
  const words: Record<string, string> = {
    wages: 'wages', stock: 'stock', service: 'running costs',
    tax: 'tax', unknown: 'not recognised',
  };
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${words[k] ?? k}`)
    .join(' · ');
}

export default function ImportPage() {
  const refreshTwin = useStore(s => s.refreshTwin);
  const { profile } = useProfile();
  const currency = (profile?.currency as string | null) || 'ZMW';
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'review' | 'importing' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<DocScan | null>(null);
  const [repeat, setRepeat] = useState<AlreadyImportedError | null>(null);
  const [result, setResult] = useState<DocImportResult | null>(null);

  // The owner's choices: which tables to bring in, what each one is, and the
  // answers to what AI-BOS could not work out on its own.
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [types, setTypes] = useState<Record<string, EventType>>({});
  const [answers, setAnswers] = useState<Record<string, DocAnswer>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // For "point it at somebody I already have" — loaded once, quietly.
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    void listEmployees().then(setEmployees).catch(() => setEmployees([]));
    void listProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  const onPick = useCallback(async (picked: File) => {
    setError(null); setResult(null); setRepeat(null); setAnswers({});
    setPhase('scanning'); setFile(picked);
    try {
      const s = await documentScan(picked);
      setScan(s);
      setKeep(Object.fromEntries(s.tables.map(t => [t.id, t.import])));
      setTypes(Object.fromEntries(s.tables.map(t => [t.id, t.event_type])));
      setPhase('review');
    } catch (e) {
      setError((e as Error).message || 'Could not read that file.');
      setPhase('idle');
    }
  }, []);

  async function commit(force = false) {
    if (!scan || !file) return;
    setError(null); setRepeat(null); setPhase('importing');
    try {
      const chosen = scan.tables
        .filter(t => keep[t.id])
        .map(t => ({ id: t.id, event_type: types[t.id] ?? t.event_type, mapping: t.mapping }));
      const res = await documentImport(file, chosen, answers, { currency, force });
      setResult(res);
      refreshTwin();
      setPhase('done');
    } catch (e) {
      if (e instanceof AlreadyImportedError) setRepeat(e);
      else setError((e as Error).message || 'Import failed.');
      setPhase('review');
    }
  }

  function reset() {
    setScan(null); setResult(null); setPhase('idle'); setError(null);
    setFile(null); setRepeat(null); setKeep({}); setTypes({}); setAnswers({}); setOpen({});
    if (fileRef.current) fileRef.current.value = '';
  }

  const keptTables = scan?.tables.filter(t => keep[t.id]) ?? [];
  const keptRows = keptTables.reduce((n, t) => n + t.nonzero_rows, 0);
  const unanswered = (scan?.questions ?? []).filter(q => !answers[q.key]).length;

  function answer(q: DocQuestion, a: DocAnswer) {
    setAnswers(prev => ({ ...prev, [q.key]: a }));
  }

  return (
    <>
      <PageHeader
        title="Import history"
        subtitle="Any spreadsheet, any layout — AIBOS reads every sheet and files each row where it belongs."
      />

      {(phase === 'idle' || phase === 'scanning') && (
        <SectionCard title="Choose a file" subtitle="Excel (.xlsx/.xls) or CSV — every sheet is read">
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) void onPick(f); }}
            disabled={phase === 'scanning'}
            style={{
              display: 'block', width: '100%', padding: '20px', minHeight: 56,
              border: '1px dashed var(--upload-border)', borderRadius: 10,
              background: 'var(--upload-bg)', color: 'var(--text-2)',
              fontSize: 'var(--fs-body)', cursor: 'pointer',
            }}
          />
          {phase === 'scanning' && (
            <p style={{ marginTop: 12, color: 'var(--text-3)', fontSize: 'var(--fs-body)' }}>
              Reading every sheet in your file…
            </p>
          )}
        </SectionCard>
      )}

      {error && (
        <div role="alert" style={{ margin: '12px 0', padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-body)' }}>
          {error}
        </div>
      )}

      {phase !== 'done' && phase !== 'idle' && phase !== 'scanning' && scan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* What was in the file ------------------------------------------ */}
          <SectionCard
            title="What AIBOS found"
            subtitle={`${scan.sheet_count} sheets · ${scan.table_count} tables · ${scan.nonzero_total.toLocaleString()} of ${scan.row_total.toLocaleString()} rows have a figure in`}
          >
            {scan.nonzero_total === 0 && (
              <div style={{ ...noteBox, marginBottom: 16 }}>
                <strong>Every figure in this file is blank or zero.</strong> It looks like a
                template nobody has filled in yet. There is nothing to import until it has
                some real numbers in it.
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {scan.sheets.map(s => (
                <span
                  key={s.name}
                  title={s.reason || `${s.tables.length} table(s)`}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 'var(--fs-data)',
                    border: '1px solid var(--border-md)',
                    background: s.skipped ? 'transparent' : 'var(--bg-input)',
                    color: s.skipped ? 'var(--text-4)' : 'var(--text-2)',
                    textDecoration: s.skipped ? 'line-through' : 'none',
                  }}
                >
                  {s.name}{s.hidden ? ' (hidden)' : ''}
                  {!s.skipped && s.tables.length > 1 ? ` · ${s.tables.length} tables` : ''}
                </span>
              ))}
            </div>
            <p style={{ marginTop: 12, marginBottom: 0, color: 'var(--text-3)', fontSize: 'var(--fs-data)', lineHeight: 1.5 }}>
              {scan.ai
                ? 'The AI read the file and described each table below.'
                : 'AIBOS read the file with its own rules.'}
              {scan.ai_note ? ` ${scan.ai_note}` : ''}
              {' '}It already knows {scan.known.employees} worker{scan.known.employees === 1 ? '' : 's'},
              {' '}{scan.known.products} product{scan.known.products === 1 ? '' : 's'} and
              {' '}{scan.known.parties} customer{scan.known.parties === 1 ? '' : 's'}/supplier{scan.known.parties === 1 ? '' : 's'}.
            </p>
          </SectionCard>

          {/* What only the owner can settle -------------------------------- */}
          {scan.questions.length > 0 && (
            <SectionCard
              title="AIBOS needs you on a few of these"
              subtitle={unanswered > 0
                ? `${unanswered} still to answer — anything you leave is imported as AIBOS read it`
                : 'All answered'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {scan.questions.map(q => {
                  const given = answers[q.key];
                  return (
                    <div key={q.key} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-input)' }}>
                      <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-1)', lineHeight: 1.5 }}>
                        {q.ask}{' '}
                        <span style={{ color: 'var(--text-3)' }}>
                          ({q.count} line{q.count === 1 ? '' : 's'}, sheet &ldquo;{q.sheet}&rdquo;)
                        </span>
                      </p>
                      {q.closest && (
                        <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>
                          The closest thing you already have is <strong>{q.closest}</strong>.
                        </p>
                      )}

                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {q.type === 'unknown_worker' && (
                          <>
                            <button type="button" className="touch-target"
                              style={chip(given?.action === 'add_worker')}
                              onClick={() => answer(q, { action: 'add_worker', employee_name: q.name })}>
                              Record as {q.name}&apos;s wages
                            </button>
                            {employees.length > 0 && (
                              <select
                                aria-label={`Point ${q.name} at a worker you already have`}
                                value={given?.action === 'use_worker' ? (given.employee_id ?? '') : ''}
                                onChange={e => {
                                  const emp = employees.find(x => x.id === e.target.value);
                                  if (emp) answer(q, { action: 'use_worker', employee_id: emp.id, employee_name: emp.name });
                                }}
                                style={{ ...sel, maxWidth: 240, width: 'auto' }}
                              >
                                <option value="">Point it at a worker I have…</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                              </select>
                            )}
                          </>
                        )}

                        {q.type === 'unknown_product' && (
                          <>
                            <button type="button" className="touch-target"
                              style={chip(given?.action === 'add_product')}
                              onClick={() => answer(q, { action: 'add_product', product_name: q.name })}>
                              Record as a new product
                            </button>
                            {products.length > 0 && (
                              <select
                                aria-label="Point it at a product you already have"
                                value={given?.action === 'use_product' ? (given.product_id ?? '') : ''}
                                onChange={e => {
                                  const p = products.find(x => x.id === e.target.value);
                                  if (p) answer(q, { action: 'use_product', product_id: p.id, product_name: p.name });
                                }}
                                style={{ ...sel, maxWidth: 240, width: 'auto' }}
                              >
                                <option value="">Point it at a product I have…</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            )}
                          </>
                        )}

                        {q.type === 'missing_quantity' && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
                            How many?
                            <input
                              type="number" min={0} step="any" inputMode="decimal"
                              defaultValue={given?.quantity ?? ''}
                              onChange={e => {
                                const n = parseFloat(e.target.value);
                                if (Number.isFinite(n) && n > 0) answer(q, { action: 'set_quantity', quantity: n });
                              }}
                              style={{ ...sel, width: 120 }}
                            />
                          </label>
                        )}

                        {q.type === 'uncategorised' && (
                          <input
                            type="text" placeholder="What was it for? e.g. laundry"
                            defaultValue={given?.category ?? ''}
                            onChange={e => {
                              const v = e.target.value.trim();
                              if (v) answer(q, { action: 'set_category', category: v });
                            }}
                            style={{ ...sel, maxWidth: 260 }}
                          />
                        )}

                        <button type="button" className="touch-target"
                          style={chip(given?.action === 'expense')}
                          onClick={() => answer(q, { action: 'expense', category: 'general' })}>
                          Just an expense
                        </button>
                        <button type="button" className="touch-target"
                          style={chip(given?.action === 'skip')}
                          onClick={() => answer(q, { action: 'skip' })}>
                          Leave these out
                        </button>
                        {given && (
                          <button type="button" className="touch-target"
                            style={{ ...quietBtn, padding: '6px 12px', minHeight: 36 }}
                            onClick={() => setAnswers(prev => {
                              const next = { ...prev }; delete next[q.key]; return next;
                            })}>
                            Undo
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Every table, and what it is ----------------------------------- */}
          <SectionCard
            title="What to bring in"
            subtitle={`${keptTables.length} of ${scan.tables.length} tables selected · ${keptRows.toLocaleString()} rows with a figure`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scan.tables.map((t: DocTable) => {
                const on = !!keep[t.id];
                return (
                  <div key={t.id} style={{
                    padding: '12px 14px', borderRadius: 10,
                    border: `1px solid ${on ? 'var(--border-md)' : 'var(--border-sm, var(--border-md))'}`,
                    background: on ? 'var(--bg-input)' : 'transparent',
                    opacity: on ? 1 : 0.62,
                  }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 40 }}>
                        <input
                          type="checkbox" checked={on}
                          onChange={e => setKeep(k => ({ ...k, [t.id]: e.target.checked }))}
                          style={{ width: 20, height: 20, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>
                          {t.title}
                        </span>
                      </label>
                      <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', alignSelf: 'center' }}>
                        sheet &ldquo;{t.sheet}&rdquo; · headings on row {t.header_row} ·
                        {' '}{t.nonzero_rows.toLocaleString()} of {t.row_count.toLocaleString()} rows have a figure
                        {t.orientation === 'matrix' ? ' · a month per column' : ''}
                      </span>
                    </div>

                    {(t.what_it_is || t.reason) && (
                      <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-data)', color: 'var(--text-2)', lineHeight: 1.5 }}>
                        {t.what_it_is}{t.reason ? ` — ${t.reason}` : ''}
                      </p>
                    )}
                    {t.counts && (
                      <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>
                        {describeCounts(t.counts)}
                      </p>
                    )}
                    {t.notes.map((n, i) => (
                      <p key={i} style={{ margin: '4px 0 0', fontSize: 'var(--fs-data)', color: 'var(--text-3)', lineHeight: 1.5 }}>{n}</p>
                    ))}

                    {on && (
                      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div>
                          <label style={label} htmlFor={`type-${t.id}`}>Record these as</label>
                          <select
                            id={`type-${t.id}`}
                            value={types[t.id] ?? t.event_type}
                            onChange={e => setTypes(x => ({ ...x, [t.id]: e.target.value as EventType }))}
                            style={{ ...sel, maxWidth: 220 }}
                          >
                            {TYPES.map(x => <option key={x} value={x}>{x}</option>)}
                          </select>
                        </div>
                        <p style={{ margin: 0, fontSize: 'var(--fs-data)', color: 'var(--text-3)', lineHeight: 1.6 }}>
                          Date: <strong>{t.mapping.date ?? '—'}</strong> ·
                          {' '}Amount: <strong>{t.mapping.amount ?? '—'}</strong> ·
                          {' '}Who: <strong>{t.mapping.counterparty ?? '—'}</strong> ·
                          {' '}Details: <strong>{t.mapping.description ?? '—'}</strong>
                        </p>
                        <button type="button" className="touch-target"
                          style={{ ...quietBtn, padding: '6px 12px', minHeight: 36 }}
                          onClick={() => setOpen(o => ({ ...o, [t.id]: !o[t.id] }))}>
                          {open[t.id] ? 'Hide rows' : 'Show rows'}
                        </button>
                      </div>
                    )}

                    {on && open[t.id] && t.rows.length > 0 && (
                      <div style={{ overflowX: 'auto', marginTop: 12 }}>
                        <table className="data-table">
                          <thead>
                            <tr>{t.columns.slice(0, 8).map(c => <th key={c}>{c}</th>)}</tr>
                          </thead>
                          <tbody>
                            {t.rows.slice(0, 8).map((r, i) => (
                              <tr key={i}>
                                {t.columns.slice(0, 8).map(c => (
                                  <td key={c}>{r[c] == null || r[c] === '' ? '—' : String(r[c])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {repeat && (
              <div role="alert" style={{ ...noteBox, marginTop: 16 }}>
                <strong>You have imported this file before.</strong>{' '}
                {repeat.importedAt
                  ? `On ${new Date(repeat.importedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Earlier'}
                {repeat.savedCount ? `, ${repeat.savedCount.toLocaleString()} rows were recorded` : ''}.
                {' '}Importing it again records every row a second time and doubles those figures.
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button type="button" onClick={reset} className="touch-target"
                    style={{ ...primaryBtn, background: 'var(--cyan)', color: '#04121a' }}>
                    Don&apos;t import it again
                  </button>
                  <button type="button" onClick={() => void commit(true)} className="touch-target" style={quietBtn}>
                    Import it again anyway
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                type="button" className="touch-target"
                onClick={() => void commit()}
                disabled={phase === 'importing' || !!repeat || keptTables.length === 0}
                style={{ ...primaryBtn, opacity: phase === 'importing' || repeat || !keptTables.length ? 0.6 : 1 }}
              >
                {phase === 'importing'
                  ? 'Importing…'
                  : `Import ${keptRows.toLocaleString()} row${keptRows === 1 ? '' : 's'}`}
              </button>
              <button type="button" onClick={reset} className="touch-target" style={quietBtn}>
                Choose another file
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* What happened -------------------------------------------------- */}
      {phase === 'done' && result && (
        <SectionCard title="Import complete" subtitle="Your dashboards have been updated">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--green)' }}>
                {result.saved_count.toLocaleString()}
              </div>
              <div style={label}>imported</div>
            </div>
            {result.error_count > 0 && (
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--amber)' }}>
                  {result.error_count.toLocaleString()}
                </div>
                <div style={label}>skipped</div>
              </div>
            )}
          </div>

          {result.tables.length > 0 && (
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--text-2)', fontSize: 'var(--fs-body)', lineHeight: 1.7 }}>
              {result.tables.map(t => (
                <li key={t.table}>
                  <strong>{t.title}</strong> ({t.sheet}) — {t.events.toLocaleString()} recorded as {t.event_type}
                  {describeCounts(t.counts) ? `: ${describeCounts(t.counts)}` : ''}
                </li>
              ))}
            </ul>
          )}

          {(result.recorded?.employees?.length || result.recorded?.products?.length) ? (
            <div style={{ ...noteBox, borderColor: 'var(--green)', background: 'var(--green-dim, rgba(52,211,153,0.12))', marginBottom: 16 }}>
              <strong>Added to your records, so you are not asked again:</strong>{' '}
              {[...(result.recorded.employees ?? []), ...(result.recorded.products ?? [])].join(', ')}.
            </div>
          ) : null}

          {result.workers_not_on_register.length > 0 && (
            <div style={{ ...noteBox, marginBottom: 16 }}>
              <strong>These wages went in against people who are not on your worker list:</strong>{' '}
              {result.workers_not_on_register.join(', ')}. Add them under Employees so their
              pay, NAPSA and PAYE are worked out properly from now on.
              <div style={{ marginTop: 10 }}>
                <a href="/dashboard/payroll" style={{ ...primaryBtn, background: 'var(--cyan)', color: '#04121a', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                  Add them now →
                </a>
              </div>
            </div>
          )}

          {result.products_not_on_list.length > 0 && (
            <div style={{ ...noteBox, marginBottom: 16 }}>
              <strong>These purchases were not matched to a product:</strong>{' '}
              {result.products_not_on_list.join(', ')}. Add them under Products so stock
              moves when you buy and sell them.
              <div style={{ marginTop: 10 }}>
                <a href="/dashboard/products" style={{ ...primaryBtn, background: 'var(--cyan)', color: '#04121a', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                  Add them now →
                </a>
              </div>
            </div>
          )}

          {(result.error_count > 0 || result.skipped.length > 0) && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-body)', color: 'var(--text-3)', minHeight: 40 }}>
                What was left out, and why
              </summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text-3)', fontSize: 'var(--fs-data)', lineHeight: 1.6 }}>
                {result.skipped.slice(0, 50).map((s, i) => (
                  <li key={`s${i}`}>{s.row != null ? `Row ${s.row}` : s.table}: {s.why}</li>
                ))}
                {result.errors.slice(0, 50).map((e, i) => (
                  <li key={`e${i}`}>{e.row != null ? `Row ${e.row}` : `Entry ${(e.index ?? 0) + 1}`}: {e.error}</li>
                ))}
              </ul>
            </details>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/dashboard/timeline" style={{ ...primaryBtn, background: 'var(--cyan)', color: '#04121a', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              View timeline →
            </a>
            <button type="button" onClick={reset} className="touch-target" style={quietBtn}>
              Import another
            </button>
          </div>
        </SectionCard>
      )}
    </>
  );
}
