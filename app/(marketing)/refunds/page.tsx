import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description:
    'Every AIBOS card payment has a 30-day money-back guarantee, no reason needed. How to ask, what happens to your plan and how mobile money mistakes are put right.',
  alternates: { canonical: '/refunds' },
};

// The refund policy Paddle's website review asks for. The owner chose a 30-day
// money-back guarantee on card payments (2026-09-21), the length Paddle
// recommends. Mobile money payments are never taken again automatically, so
// the promise there is to put mistakes right; widen it here if that changes.
type Part = string | { text: string; href: string; after?: string };
const SECTIONS: { h: string; body: Part[][] }[] = [
  {
    h: '30 days to change your mind',
    body: [
      ['If AIBOS is not right for you, ask for your money back within 30 days of any card payment. You get the whole of that payment back. You do not have to give a reason.'],
      ['Card payments are sold by our online reseller Paddle.com, so Paddle makes the refund, to the card or account you paid with. Paddle aims to refund within 14 days of approving it. When it shows on your statement depends on your bank.'],
    ],
  },
  {
    h: 'How to ask',
    body: [
      ['Email ', { text: LEGAL.email, href: `mailto:${LEGAL.email}` }, ' from the address you paid with, or reply to the receipt Paddle emailed you. Tell us which payment, if you have more than one.'],
      ['You can also ask Paddle directly at ', { text: 'paddle.net', href: 'https://paddle.net', after: '.' }],
    ],
  },
  {
    h: 'What happens to your plan',
    body: [
      ['A refunded plan ends when the refund is made and does not renew again. The account moves to the Free plan.'],
      ['Your records all stay. You can export them at any time, on any plan.'],
    ],
  },
  {
    h: 'Cancelling without a refund',
    body: [
      ['You can cancel a card plan’s renewal at any time on Plan & billing. The plan stays on until the end of the period you paid for and your card is not charged again.'],
      ['After the 30 days, we do not refund part of a period that has already started.'],
    ],
  },
  {
    h: 'Mobile money payments',
    body: [
      ['A mobile money payment covers one month or one year and is never taken again automatically, so there is nothing to cancel.'],
      [`If something went wrong with one, such as being charged twice or charged the wrong amount, contact us on ${LEGAL.phoneDisplay} or at `, { text: LEGAL.email, href: `mailto:${LEGAL.email}` }, '. We will put it right and send the money back to the same mobile money number.'],
    ],
  },
  {
    h: 'Your rights under the law',
    body: [
      ['This policy adds to the rights you have under the law where you live. It never takes them away.'],
    ],
  },
];

export default function RefundsPage() {
  return (
    <section className="mkt-section mkt-section--tight">
      <div className="mkt-wrap" style={{ maxWidth: 760 }}>
        <p className="mkt-eyebrow">Legal</p>
        <h1 className="mkt-h1" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.8rem)', marginBottom: 10 }}>Refund Policy</h1>
        <p className="mkt-lead" style={{ marginBottom: 8 }}>
          A 30-day money-back guarantee on every card payment. Last updated {LEGAL.refundsUpdated}.
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', marginBottom: 40 }}>
          This is part of our <Link href="/terms" style={{ color: 'var(--cyan)' }}>Terms of Service</Link>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {SECTIONS.map((s) => (
            <div key={s.h}>
              <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 12px' }}>{s.h}</h2>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.body.map((parts, i) => (
                  <li key={i} style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.6 }}>
                    {parts.map((p, j) => typeof p === 'string'
                      ? <span key={j}>{p}</span>
                      : <span key={j}><Link href={p.href} style={{ color: 'var(--cyan)' }}>{p.text}</Link>{p.after ?? ''}</span>)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
