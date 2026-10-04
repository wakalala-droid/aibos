'use client';
/**
 * AIBOS — one question at a time, with the lines it is about in front of you.
 *
 * The first version listed every question at once, each reading "Money came in
 * here, but AIBOS cannot tell what for. (2 lines, sheet Sheet1)". Nobody can
 * answer that. It names no figure, no day, and none of the words from their own
 * book, so the only ways through it are to guess or to skip — and guessing is
 * how a wrong figure gets into real books.
 *
 * So: one question on screen, the actual lines underneath it, what each answer
 * will do, and how many are left. The person deciding is deciding where real
 * money goes, and they should be able to see exactly what they are deciding
 * about.
 */
import { useMemo, useState } from 'react';
import type { DocQuestion, DocAnswer, Employee, Product } from '@/lib/api';

const TITLES: Record<string, string> = {
  unknown_worker: 'A payment to someone not on your worker list',
  unknown_product: 'A purchase of something not on your product list',
  missing_quantity: 'A purchase with no count',
  uncategorised: 'A payment AIBOS could not place',
  money_in_kind: 'Money coming in',
};

const money = (n: number | null | undefined, sym: string) =>
  n == null ? 'None' : `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const card: React.CSSProperties = {
  padding: '20px 22px', borderRadius: 14, border: '1px solid var(--border-md)',
  background: 'var(--bg-input)',
};
const btn = (on: boolean): React.CSSProperties => ({
  padding: '12px 18px', minHeight: 48, borderRadius: 10, cursor: 'pointer',
  border: on ? '1px solid var(--cyan)' : '1px solid var(--border-md)',
  background: on ? 'var(--cyan)' : 'transparent',
  color: on ? 'var(--on-cyan)' : 'var(--text-1)',
  fontSize: 'var(--fs-body)', fontWeight: on ? 700 : 600, textAlign: 'left',
});
const quiet: React.CSSProperties = {
  padding: '10px 16px', minHeight: 44, borderRadius: 10,
  border: '1px solid var(--border-md)', background: 'transparent',
  color: 'var(--text-2)', fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer',
};
const field: React.CSSProperties = {
  width: '100%', padding: '12px 14px', minHeight: 48, background: 'var(--bg-page)',
  border: '1px solid var(--border-md)', borderRadius: 10, color: 'var(--text-1)',
  fontSize: 'var(--fs-body)', outline: 'none',
};

export default function QuestionFlow({
  questions, answers, onAnswer, onUndo, employees, products, currencySymbol,
}: {
  questions: DocQuestion[];
  answers: Record<string, DocAnswer>;
  onAnswer: (q: DocQuestion, a: DocAnswer) => void;
  onUndo: (q: DocQuestion) => void;
  employees: Employee[];
  products: Product[];
  currencySymbol: string;
}) {
  const [at, setAt] = useState(0);
  const total = questions.length;
  const answeredCount = useMemo(
    () => questions.filter(q => answers[q.key]).length, [questions, answers]);

  if (!total) return null;
  const i = Math.min(at, total - 1);
  const q = questions[i];
  const given = answers[q.key];
  const sym = currencySymbol;

  // Answering moves on by itself: the owner should feel they are getting
  // somewhere, not filling in a form.
  function answer(a: DocAnswer) {
    onAnswer(q, a);
    if (i < total - 1) setTimeout(() => setAt(i + 1), 180);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Where you are */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>
          Question {i + 1} of {total}
        </span>
        <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>
          {answeredCount} answered · anything you skip is imported the way AIBOS read it
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4 }} aria-hidden>
        {questions.map((x, n) => (
          <span key={x.key} style={{
            flex: 1, height: 5, borderRadius: 3,
            background: answers[x.key] ? 'var(--green)'
              : n === i ? 'var(--cyan)' : 'var(--border-md)',
          }} />
        ))}
      </div>

      {/* The question */}
      <div style={card}>
        <p style={{
          margin: '0 0 6px',
          fontSize: 'var(--fs-label)',
          fontWeight: 700,
          color: 'var(--text-3)',
        }}>
          {TITLES[q.type] ?? 'Needs your answer'}
        </p>
        <h3 style={{
          margin: '0 0 8px', fontSize: 'var(--fs-h3)', fontWeight: 700,
          color: 'var(--text-1)', lineHeight: 1.35,
        }}>
          {q.title || q.ask}
        </h3>
        {q.title && (
          <p style={{ margin: '0 0 8px', fontSize: 'var(--fs-body)', color: 'var(--text-1)', lineHeight: 1.6 }}>
            {q.ask}
          </p>
        )}
        {q.why && (
          <p style={{ margin: '0 0 14px', fontSize: 'var(--fs-body)', color: 'var(--text-3)', lineHeight: 1.6 }}>
            {q.why}
          </p>
        )}

        <p style={{ margin: '0 0 8px', fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
          <strong>{q.count}</strong> line{q.count === 1 ? '' : 's'} in your file
          {q.total ? <> · <strong>{money(q.total, sym)}</strong> in total</> : null}
          {q.sheets?.length ? <> · {q.sheets.length === 1 ? 'sheet' : 'sheets'} {q.sheets.join(', ')}</> : null}
        </p>

        {/* The lines themselves — the whole point. */}
        {(q.lines?.length ?? 0) > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <table className="data-table">
              <thead>
                <tr><th>Row</th><th>Date</th><th>What the line says</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
              </thead>
              <tbody>
                {q.lines!.slice(0, 6).map((ln, n) => (
                  <tr key={`${ln.sheet}-${ln.row}-${n}`}>
                    <td style={{ color: 'var(--text-3)' }}>
                      {ln.sheet ? `${ln.sheet} ` : ''}{ln.row}
                    </td>
                    <td>{ln.date || 'None'}</td>
                    <td>{ln.description || 'None'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(ln.amount, sym)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {q.count > (q.lines?.length ?? 0) && (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>
                …and {q.count - q.lines!.length} more line{q.count - q.lines!.length === 1 ? '' : 's'} like these.
              </p>
            )}
          </div>
        )}

        {q.closest && (
          <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
            The closest thing you already have is <strong>{q.closest}</strong>: is it the same one?
          </p>
        )}

        {/* What you can do about it */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {q.type === 'unknown_worker' && (
            <>
              <button type="button" className="touch-target" style={btn(given?.action === 'add_worker')}
                onClick={() => answer({ action: 'add_worker', employee_name: q.name })}>
                Add {q.name} to my workers and record these as their wages
              </button>
              {employees.length > 0 && (
                <select
                  aria-label={`Point ${q.name} at a worker you already have`}
                  value={given?.action === 'use_worker' ? (given.employee_id ?? '') : ''}
                  onChange={e => {
                    const emp = employees.find(x => x.id === e.target.value);
                    if (emp) answer({ action: 'use_worker', employee_id: emp.id, employee_name: emp.name });
                  }}
                  style={field}
                >
                  <option value="">This is someone I already have…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}
            </>
          )}

          {q.type === 'unknown_product' && (
            <>
              <button type="button" className="touch-target" style={btn(given?.action === 'add_product')}
                onClick={() => answer({ action: 'add_product', product_name: q.name })}>
                Add this as a new product
              </button>
              {products.length > 0 && (
                <select
                  aria-label="Point it at a product you already have"
                  value={given?.action === 'use_product' ? (given.product_id ?? '') : ''}
                  onChange={e => {
                    const p = products.find(x => x.id === e.target.value);
                    if (p) answer({ action: 'use_product', product_id: p.id, product_name: p.name });
                  }}
                  style={field}
                >
                  <option value="">This is a product I already have…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </>
          )}

          {q.type === 'missing_quantity' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
              How many were bought?
              <input type="number" min={0} step="any" inputMode="decimal"
                defaultValue={given?.quantity ?? ''}
                onBlur={e => {
                  const n = parseFloat(e.target.value);
                  if (Number.isFinite(n) && n > 0) answer({ action: 'set_quantity', quantity: n });
                }}
                style={{ ...field, maxWidth: 200 }} />
            </label>
          )}

          {q.type === 'uncategorised' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
              What was it for?
              <input type="text" placeholder="e.g. laundry, transport, repairs"
                defaultValue={given?.category ?? ''}
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (v) answer({ action: 'set_category', category: v });
                }}
                style={field} />
            </label>
          )}

          {q.type === 'money_in_kind' && (
            <>
              <button type="button" className="touch-target" style={btn(given?.action === 'sale')}
                onClick={() => answer({ action: 'sale' })}>
                The business earned it: record it as a sale
              </button>
              <button type="button" className="touch-target" style={btn(given?.action === 'funding')}
                onClick={() => answer({ action: 'funding' })}>
                It was money put in to spend: not income
              </button>
              <button type="button" className="touch-target" style={btn(given?.action === 'transfer')}
                onClick={() => answer({ action: 'transfer' })}>
                It was moved between my own accounts
              </button>
            </>
          )}

          {q.type !== 'money_in_kind' && (
            <button type="button" className="touch-target" style={btn(given?.action === 'expense')}
              onClick={() => answer({ action: 'expense', category: 'general' })}>
              Just record it as an ordinary expense
            </button>
          )}
          <button type="button" className="touch-target" style={btn(given?.action === 'skip')}
            onClick={() => answer({ action: 'skip' })}>
            Leave {q.count === 1 ? 'this line' : 'these lines'} out of my books
          </button>
        </div>

        {given && (
          <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-body)', color: 'var(--green)', fontWeight: 600 }}>
            Answered.{' '}
            <button type="button" onClick={() => onUndo(q)}
              style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 'var(--fs-body)', textDecoration: 'underline', padding: 0 }}>
              change it
            </button>
          </p>
        )}
      </div>

      {/* Moving about */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="touch-target" style={quiet}
          disabled={i === 0} onClick={() => setAt(i - 1)}>
          ← Back
        </button>
        <button type="button" className="touch-target" style={quiet}
          disabled={i >= total - 1} onClick={() => setAt(i + 1)}>
          {given ? 'Next →' : 'Skip for now →'}
        </button>
        {answeredCount < total && (
          <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>
            You can import without answering them all.
          </span>
        )}
      </div>
    </div>
  );
}
