'use client';
/**
 * AIBOS — the annual leave each person is owed.
 *
 * At least 2 days a month on full pay (Employment Code Act 2019, s.36(1)),
 * earned with every payroll run for the month worked; the days taken and paid
 * out come off. Leave not taken is paid when someone leaves (s.36(5)), so the
 * days owed are money owed: shown with what paying them out would cost (full
 * pay x days / 26, Fifth Schedule). aibos-api payroll.leave_book.
 */
import { Chip, Note } from '@/components/hospitality/kit';
import type { LeaveBook } from '@/lib/api';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

export default function LeaveCard({ book, money }: { book: LeaveBook; money: (v: number) => string }) {
  if (!book.people.length) return null;
  return (
    <div>
      <div className="mini-stats" style={{ marginBottom: 12 }}>
        <div className="mini-stat">
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Leave days owed</span>
          <span className="money money-md">{book.total_days.toLocaleString('en-ZM', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="mini-stat">
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>If paid out</span>
          <span className="money money-md">{money(book.total_value)}</span>
        </div>
        {book.leavers_owed > 0 && (
          <div className="mini-stat">
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Owed to leavers</span>
            <span className="money money-md" style={{ color: 'var(--red)' }}>{money(book.leavers_owed)}</span>
          </div>
        )}
      </div>
      {book.people.map(p => (
        <div key={p.employee_id} className="row">
          <span className="avatar avatar-brand" aria-hidden="true">{initials(p.name || '?')}</span>
          <span className="row-main">
            <span className="row-title">
              {p.name}{' '}
              {p.status === 'left' && p.owed > 0 ? <Chip tone="bad">Left, unpaid</Chip> : p.owed > 24 ? <Chip tone="wait">Over a year&rsquo;s</Chip> : null}
            </span>
            <span className="row-sub" style={{ whiteSpace: 'normal' }}>
              {p.rate} days a month · {p.earned} earned{p.opening > 0 ? ` + ${p.opening} from before AIBOS` : ''}
              {p.taken > 0 ? ` · ${p.taken} taken` : ''}{p.paid_out > 0 ? ` · ${p.paid_out} paid out` : ''}
            </span>
          </span>
          <span className="row-amount">
            {p.owed} days<span style={{ display: 'block', color: 'var(--text-3)', fontWeight: 400, fontSize: 'var(--fs-label)' }}>{money(p.value)}</span>
          </span>
        </div>
      ))}
      <Note tone="info">
        Earned with every run. Type the days someone takes in that month&rsquo;s run; leave not taken is paid out with the last pay.
      </Note>
    </div>
  );
}
