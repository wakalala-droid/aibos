'use client';
/**
 * AI-BOS — Event list (Evolution spine). Mobile-first stacked rows (one record per
 * row, key fields only — responsive_design_system.md DATA TABLE RULE), with optional
 * confirm / void actions. Used by the Timeline and the Record page's recent list.
 */
import { motion } from 'framer-motion';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import type { BusinessEvent } from '@/lib/api';
import { amountOf, cashSign, summarize, fmtDate, STATUS_COLOR } from './eventMeta';

interface Props {
  events: BusinessEvent[];
  busyId?: string | null;
  onConfirm?: (id: string) => void;
  onVoid?: (id: string) => void;
  emptyHint?: string;
}

export default function EventList({ events, busyId, onConfirm, onVoid, emptyHint }: Props) {
  const sym = useStore(s => s.currencySymbol) || 'K';

  if (!events.length) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>
        {emptyHint ?? 'No activity yet. Record your first business event above.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map((ev, i) => {
        const sign = cashSign(ev);
        const amt = amountOf(ev);
        const voided = ev.status === 'void';
        const st = STATUS_COLOR[ev.status] ?? STATUS_COLOR.pending;
        const moneyColor = voided ? 'var(--text-4)' : sign > 0 ? 'var(--green)' : sign < 0 ? 'var(--red)' : 'var(--text-2)';
        return (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)',
              opacity: voided ? 0.6 : 1, flexWrap: 'wrap',
            }}
          >
            {/* Direction dot */}
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: moneyColor }} />

            {/* Summary + date */}
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)',
                textDecoration: voided ? 'line-through' : 'none',
              }}>
                {summarize(ev)}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-4)', marginTop: 2 }}>
                {fmtDate(ev.occurred_at)} · {ev.source}
              </div>
            </div>

            {/* Amount */}
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', fontWeight: 600,
              color: moneyColor, whiteSpace: 'nowrap',
            }}>
              {amt ? `${sign < 0 ? '−' : sign > 0 ? '+' : ''}${sym}${fmt(amt)}` : '—'}
            </div>

            {/* Status */}
            <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>

            {/* Actions */}
            {!voided && (onConfirm || onVoid) && (
              <div style={{ display: 'flex', gap: 6 }}>
                {onConfirm && ev.status === 'pending' && (
                  <button
                    type="button" onClick={() => onConfirm(ev.id)} disabled={busyId === ev.id} className="touch-target"
                    aria-label="Confirm event"
                    style={{ padding: '6px 12px', minHeight: 32, borderRadius: 6, border: 'none', background: 'var(--green-dim)', color: 'var(--green)', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {busyId === ev.id ? '…' : 'Confirm'}
                  </button>
                )}
                {onVoid && (
                  <button
                    type="button" onClick={() => onVoid(ev.id)} disabled={busyId === ev.id} className="touch-target"
                    aria-label="Void event"
                    style={{ padding: '6px 12px', minHeight: 32, borderRadius: 6, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {busyId === ev.id ? '…' : 'Void'}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
