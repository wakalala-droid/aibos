'use client';
/**
 * AIBOS — Event list (Evolution spine), as a statement (redesign 2026-10).
 * Entries read the way a bank shows them: grouped by day, a round in/out mark,
 * who or what on top, how it moved underneath and the amount in green or red,
 * with Confirm, Fix and Remove on the row. Used by Activity and the Record
 * page's recent list.
 */
import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Repeat, Check, Pencil, Trash2 } from 'lucide-react';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import type { BusinessEvent } from '@/lib/api';
import { amountOf, cashSign, summarize, whoOf, howOf, dayHeading, byDay, STATUS_COLOR } from './eventMeta';
import EntryEditor from './EntryEditor';

interface Props {
  events: BusinessEvent[];
  busyId?: string | null;
  onConfirm?: (id: string) => void;
  onVoid?: (id: string) => void;
  /** Turns on "Fix": called after an entry was corrected, to reload. */
  onChanged?: () => void;
  emptyHint?: string;
}

// Flatten ev.corrections ({ isoTime: { "payload.field": {from,to} } }) into
// readable "field: from → to" lines, newest first (audit #61).
function correctionLines(corrections?: Record<string, unknown>): { when: string; field: string; from: string; to: string }[] {
  if (!corrections) return [];
  const out: { when: string; field: string; from: string; to: string }[] = [];
  for (const [when, changes] of Object.entries(corrections)) {
    if (!changes || typeof changes !== 'object') continue;
    for (const [field, diff] of Object.entries(changes as Record<string, { from?: unknown; to?: unknown }>)) {
      out.push({
        when,
        field: field.replace(/^payload\./, '').replace(/_/g, ' '),
        from: String((diff as { from?: unknown }).from ?? 'blank'),
        to: String((diff as { to?: unknown }).to ?? 'blank'),
      });
    }
  }
  return out.sort((a, b) => b.when.localeCompare(a.when));
}

export default function EventList({ events, busyId, onConfirm, onVoid, onChanged, emptyHint }: Props) {
  const sym = useStore(s => s.currencySymbol) || 'K';
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);

  if (!events.length) {
    return (
      <p style={{ padding: '24px 0', margin: 0, color: 'var(--text-3)', fontSize: 'var(--fs-body)' }}>
        {emptyHint ?? 'No activity yet. Record your first business event above.'}
      </p>
    );
  }

  return (
    <div>
      {byDay(events).map((g) => (
        <div key={g.key}>
          <p className="day-label">{dayHeading(g.key)}</p>
          {g.rows.map((ev) => {
            const sign = cashSign(ev);
            const amt = amountOf(ev);
            const voided = ev.status === 'void';
            const st = STATUS_COLOR[ev.status] ?? STATUS_COLOR.pending;
            const busy = busyId === ev.id;
            const edited = !!ev.corrections && Object.keys(ev.corrections).length > 0;
            return (
              <div key={ev.id}>
                <div className="row" style={{ flexWrap: 'wrap', opacity: voided ? 0.6 : 1 }}>
                  <span className={`avatar ${voided ? '' : sign > 0 ? 'avatar-in' : sign < 0 ? 'avatar-out' : ''}`} aria-hidden="true">
                    {sign > 0 ? <ArrowDownLeft /> : sign < 0 ? <ArrowUpRight /> : <Repeat />}
                  </span>
                  <span className="row-main" style={{ minWidth: 160 }}>
                    <span className="row-title" style={{ textDecoration: voided ? 'line-through' : 'none' }}>{whoOf(ev)}</span>
                    <span className="row-sub" style={{ whiteSpace: 'normal' }}>
                      {howOf(ev)}
                      {/* Trust provenance (audit #62): how sure the reading was
                          when it wasn't typed by hand, so AI-read entries are never silent. */}
                      {ev.source !== 'manual' && typeof ev.confidence === 'number' && ev.confidence < 0.99 && (
                        <span style={{ color: 'var(--warn)', fontWeight: 600 }}> · about {Math.round(ev.confidence * 100)}% sure</span>
                      )}
                      {/* Edit history (audit #61): tap to see exactly what changed. */}
                      {edited && (
                        <>
                          {' · '}
                          <button type="button" onClick={() => setOpenHistory(openHistory === ev.id ? null : ev.id)}
                            aria-expanded={openHistory === ev.id}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--cyan)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit' }}>
                            {openHistory === ev.id ? 'Hide changes' : 'Changed'}
                          </button>
                        </>
                      )}
                    </span>
                  </span>

                  {ev.status !== 'confirmed' && (
                    <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                  )}

                  <span className={`row-amount${voided ? '' : sign > 0 ? ' in' : sign < 0 ? ' out' : ''}`}>
                    {amt ? `${sign < 0 ? '−' : sign > 0 ? '+' : ''}${fmt(Math.abs(amt), false, sym)}` : ''}
                  </span>

                  {!voided && (onConfirm || onVoid || onChanged) && (
                    <span className="row-actions">
                      {onConfirm && ev.status === 'pending' && (
                        <button type="button" className="pill" onClick={() => onConfirm(ev.id)} disabled={busy}
                          aria-label={`Confirm entry: ${summarize(ev)}`} style={{ color: 'var(--green)' }}>
                          <Check aria-hidden="true" />{busy ? 'Saving…' : 'Confirm'}
                        </button>
                      )}
                      {onChanged && (
                        <button type="button" className="pill pill-quiet" onClick={() => setFixing(fixing === ev.id ? null : ev.id)} disabled={busy}
                          aria-expanded={fixing === ev.id} aria-label={`Fix entry: ${summarize(ev)}`}>
                          <Pencil aria-hidden="true" />Fix
                        </button>
                      )}
                      {onVoid && (
                        <button type="button" className="pill pill-quiet" onClick={() => onVoid(ev.id)} disabled={busy}
                          aria-label={`Remove entry: ${summarize(ev)}`}>
                          <Trash2 aria-hidden="true" />Remove
                        </button>
                      )}
                    </span>
                  )}
                </div>

                {openHistory === ev.id && (
                  <div style={{ margin: '4px 0 8px 54px', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--pill-bg)', display: 'grid', gap: 4 }}>
                    {correctionLines(ev.corrections).map((c, ci) => (
                      <div key={ci} style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                        <span style={{ textTransform: 'capitalize', color: 'var(--text-2)', fontWeight: 600 }}>{c.field}</span>: {c.from} <span aria-hidden>→</span><span className="sr-only">changed to</span> <span style={{ color: 'var(--text-1)' }}>{c.to}</span>
                      </div>
                    ))}
                  </div>
                )}
                {fixing === ev.id && onChanged && (
                  <div style={{ margin: '4px 0 12px' }}>
                    <EntryEditor ev={ev} onCancel={() => setFixing(null)} onDone={() => { setFixing(null); onChanged(); }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
