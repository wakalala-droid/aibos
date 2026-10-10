'use client';

import { Check, CalendarClock } from 'lucide-react';
import { Notice } from '@/components/kit';
import Rise from '@/components/marketing/Rise';

// The morning brief and a reminder, drawn as the kit's own notices (the art
// strip, the mark, spaced capitals, pills): exactly how they arrive in the app.
const VALUES = [
  'Built only from your own numbers',
  'Nothing is sent on a day with nothing to say',
  'Reminders for NAPSA, ZRA and rent arrive the same way',
];

export default function MorningBrief() {
  return (
    <section id="brief" className="mkt-section" aria-labelledby="brief-h">
      <div className="mkt-wrap mkt-split reverse">
        <div>
          <p className="mkt-eyebrow">The morning brief</p>
          <h2 id="brief-h" className="mkt-h2">Your day, ready before you ask.</h2>
          <p className="mkt-lead" style={{ marginTop: 20, maxWidth: 520 }}>
            Every morning at 06:30: your cash, yesterday&apos;s sales, stock to reorder and the one thing
            to do today. Pro sends it to your inbox and your phone. Pro+ puts it on Home and
            sends it to WhatsApp (rolling out).
          </p>
          <ul className="mkt-values">
            {VALUES.map((v) => (
              <li key={v}><Check aria-hidden />{v}</li>
            ))}
          </ul>
        </div>

        <div className="mkt-preview">
          {/* The notices as the light app shows them, floating on the navy. */}
          <Rise className="mkt-preview mkt-brief" mode="seq" theme="light">
            <Notice
              brand
              art
              theme="light"
              title="Morning brief"
              tag="06:30"
              role="region"
              ariaLabel="A sample morning brief"
              actions={
                <>
                  <span className="pill pill-primary">Send the link</span>
                  <span className="pill pill-quiet">Open Home</span>
                </>
              }
            >
              <p style={{ margin: 0 }}><strong>K48,230.50</strong> in the business this morning, K3,120 more than yesterday.</p>
              <p style={{ margin: '8px 0 0' }}>Yesterday: 52 sales for K6,840. Reorder cooking oil: 2 left, reorder level 6.</p>
              <p style={{ margin: '8px 0 0' }}><strong>One thing today:</strong> Mwila Catering owes K2,350 and is 9 days late. Send them the payment link.</p>
            </Notice>
            <Notice
              icon={CalendarClock}
              title="NAPSA due on Friday"
              tag="Reminder"
              role="region"
              ariaLabel="A sample reminder"
            >
              Last month&apos;s NAPSA, <strong>K3,120.00</strong>. Pay by Friday so there is no penalty.
            </Notice>
          </Rise>
          <p className="mkt-preview-cap">A sample business. Your brief is written from your own records.</p>
        </div>
      </div>
    </section>
  );
}
