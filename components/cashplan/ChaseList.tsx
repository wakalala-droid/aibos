'use client';

// Ask for money first (Growth cash plan, 16 Oct 2026, second pass). Who to
// ask, in the order that helps the money most: when the plan is at risk, the
// debt that most lowers the chance of running short leads (a small debt due
// before payday can matter more than a big one that lands after the low
// point); otherwise the oldest and biggest. Each says why it is on the list
// and carries the reminder, written for the owner with their payment link,
// to send from their own WhatsApp. AIBOS never messages a customer itself.

import { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import Panel from '@/components/home/Panel';
import { dayWords } from '@/components/cashplan/PlanChart';
import { whatsAppLink, type PlanChase } from '@/lib/api';
import { notify } from '@/lib/toast';
import { fmt } from '@/lib/utils';

export default function ChaseList({ rows, sym }: { rows: PlanChase[]; sym: string }) {
  const [shown, setShown] = useState(5);
  if (!rows.length) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Reminder copied');
    } catch {
      notify('Could not copy on this device', 'error');
    }
  };

  return (
    <Panel title="Ask for money first">
      <p className="rs-text is-quiet" style={{ marginBottom: 8 }}>
        In the order that helps your money most. The reminder is written for you; you send it from your phone.
      </p>
      <ul style={{ margin: 0, padding: 0 }}>
        {rows.slice(0, shown).map((c, i) => (
          <li key={c.ref} style={{ listStyle: 'none', padding: '12px 0', borderTop: i ? '1px solid var(--border)' : undefined }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="row-title" style={{ display: 'block' }}>{c.customer}</span>
                <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                  {c.why}{c.likely_by ? ` Left alone, likely by ${dayWords(c.likely_by)}.` : ''}
                </span>
              </span>
              <span className="row-amount">{fmt(c.amount, false, sym)}</span>
            </div>
            {c.message && (
              <div className="rs-btns" style={{ marginTop: 10 }}>
                <a className="pill pill-quiet" href={whatsAppLink(c.message, c.phone)} target="_blank" rel="noopener noreferrer"
                  aria-label={`Send ${c.customer} a reminder on WhatsApp`}>
                  <MessageCircle aria-hidden="true" /> {c.phone ? 'WhatsApp' : 'WhatsApp, choose who'}
                </a>
                <button type="button" className="pill pill-quiet" onClick={() => void copy(c.message!)}
                  aria-label={`Copy the reminder for ${c.customer}`}>
                  <Copy aria-hidden="true" /> Copy
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {rows.length > shown && (
        <button type="button" className="pill pill-quiet" style={{ marginTop: 8 }} onClick={() => setShown(rows.length)}>
          {rows.length - shown} more
        </button>
      )}
    </Panel>
  );
}
