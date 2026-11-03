'use client';
/**
 * AIBOS — what the business owes its staff in gratuity.
 *
 * A fixed-term contract earns at least 25% of the basic pay earned over it
 * (Employment Code Act 2019, s.73), paid when it ends. AIBOS sets each month's
 * share aside with every run; this is the running total per person, when each
 * falls due and what is overdue (aibos-api payroll.gratuity_book). It is paid
 * tax-free with the final pay: tick "Pay gratuity" in that month's run.
 */
import { FileText } from 'lucide-react';
import { Chip, Note } from '@/components/hospitality/kit';
import type { GratuityBook } from '@/lib/api';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function GratuityCard({ book, money, onPapers, papersBusy }: {
  book: GratuityBook;
  money: (v: number) => string;
  /** The person's leaving papers, gratuity statement included. */
  onPapers?: (employeeId: string, name: string) => void;
  papersBusy?: string | null;
}) {
  if (!book.people.length) return null;
  return (
    <div>
      <div className="mini-stats" style={{ marginBottom: 12 }}>
        <div className="mini-stat">
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Owed to staff</span>
          <span className="money money-md">{money(book.total_owed)}</span>
        </div>
        <div className="mini-stat">
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Due in 60 days</span>
          <span className="money money-md">{money(book.due_soon)}</span>
        </div>
        {book.overdue > 0 && (
          <div className="mini-stat">
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Overdue</span>
            <span className="money money-md" style={{ color: 'var(--red)' }}>{money(book.overdue)}</span>
          </div>
        )}
      </div>
      {book.people.map(p => (
        <div key={p.employee_id} className="row" style={{ flexWrap: 'wrap' }}>
          <span className="avatar avatar-brand" aria-hidden="true">{initials(p.name || '?')}</span>
          <span className="row-main">
            <span className="row-title">
              {p.name}{' '}
              {p.overdue ? <Chip tone="bad">Overdue</Chip> : p.due_soon ? <Chip tone="wait">Due soon</Chip> : p.status === 'left' ? <Chip tone="off">Left</Chip> : null}
            </span>
            <span className="row-sub" style={{ whiteSpace: 'normal' }}>
              {Math.round(p.rate * 100)}% of basic pay
              {p.months_since > 0 ? ` · ${p.months_since} month${p.months_since === 1 ? '' : 's'} since ${p.last_paid_on ? `last paid ${day(p.last_paid_on)}` : 'AIBOS began'}` : ''}
              {p.due_on ? ` · ${p.status === 'left' ? 'left' : 'contract ends'} ${day(p.due_on)}` : ''}
              {p.opening > 0 ? ` · ${money(p.opening)} from before AIBOS` : ''}
            </span>
          </span>
          <span className="row-amount">{money(p.owed)}</span>
          {onPapers && (p.status === 'left' || p.overdue) && (
            <span className="row-actions">
              <button type="button" className="icon-pill" aria-label={`Leaving papers for ${p.name}`}
                disabled={papersBusy === p.employee_id} onClick={() => onPapers(p.employee_id, p.name)}>
                <FileText aria-hidden="true" />
              </button>
            </span>
          )}
        </div>
      ))}
      <Note tone="info">
        Set aside every month on the basic pay earned. It is tax-free: no PAYE, NAPSA or NHIMA. Pay it with the final pay by ticking Pay gratuity in that month&rsquo;s run.
      </Note>
    </div>
  );
}
