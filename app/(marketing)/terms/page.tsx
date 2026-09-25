import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms for using AIBOS: plans and prices, paying by card through our reseller Paddle, automatic renewal, refunds, your data and what we each promise.',
  alternates: { canonical: '/terms' },
};

// Plain-language terms, in the same voice as the privacy policy. Paddle's
// website review asks for three things here: the business name, how to reach
// us, and its Merchant of Record wording (kept word for word below). This is a
// starting text written in plain words; a lawyer should review it before any
// enterprise contract.
type Part = string | { text: string; href: string; after?: string };
const SECTIONS: { h: string; body: Part[][] }[] = [
  {
    h: 'Who we are',
    body: [
      [`${LEGAL.name} is an AI business operating system for small and medium businesses, run from ${LEGAL.city}. In these terms "${LEGAL.name}", "we" and "us" mean ${LEGAL.name}. "You" means the person or business using it.`],
      ['You can reach us at ', { text: LEGAL.email, href: `mailto:${LEGAL.email}` }, ` or on ${LEGAL.phoneDisplay}.`],
    ],
  },
  {
    h: 'Your account',
    body: [
      ['You sign in with Google. Keep your account to yourself and tell us straight away if you think someone else has used it.'],
      ['If you invite staff or an accountant, you decide what each of them can do. You are responsible for what they do in your business.'],
      ['You must be 18 or over and able to agree to these terms for your business.'],
    ],
  },
  {
    h: 'Plans and prices',
    body: [
      ['AIBOS has a Free plan and three paid plans: Pro, Pro+ and Growth. What each one includes and what it costs is on our ', { text: 'pricing page', href: '/pricing', after: '.' }],
      ['Prices are in US dollars, plus any sales tax that applies where you live. We may also show an amount in Kwacha as a guide, converted at a recent exchange rate. You are charged in US dollars, so your bank or card sets the exact Kwacha amount. The price you see at checkout is the price you pay.'],
      ['We tell you in advance before a price change affects a plan you already pay for.'],
    ],
  },
  {
    h: 'Paying and automatic renewal',
    body: [
      ['Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.'],
      ['You pay by card, PayPal, Apple Pay or Google Pay. Every paid plan is a subscription. It renews automatically at the end of each month or year, at the price you bought it for, until you cancel. Your card statement shows PADDLE.NET.'],
      ['You can cancel any time on Plan & billing in your account. The plan then stays on until the end of the period you have paid for and you are not charged again.'],
      ['Your purchase is also covered by ', { text: 'Paddle’s buyer terms', href: 'https://www.paddle.com/legal/checkout-buyer-terms', after: '.' }],
    ],
  },
  {
    h: 'Plans paid before 25 September 2026',
    body: [
      ['A plan paid by mobile money, or paid to us directly, before 25 September 2026 runs to the end of the period it paid for. It does not renew by itself. To keep it, set up card payment on Plan & billing and it renews automatically from then on.'],
      ['If you do not, everything keeps working for a week after that date. The account then moves to the Free plan. Your records stay.'],
    ],
  },
  {
    h: 'Refunds',
    body: [
      ['Every payment comes with a 30-day money-back guarantee. The details are in our ', { text: 'Refund Policy', href: '/refunds', after: '.' }],
    ],
  },
  {
    h: 'Your data',
    body: [
      ['Your business records belong to you. You can export them at any time, on any plan, including after you stop paying.'],
      ['How we collect, use and protect personal data is set out in our ', { text: 'Privacy Policy', href: '/privacy', after: '.' }],
    ],
  },
  {
    h: 'Fair use',
    body: [
      ['Do not use AIBOS to break the law, to store data you have no right to hold, to try to reach another customer’s records, to overload or attack the service, or to copy or resell the service itself.'],
      ['We may suspend an account that does any of these things. We will tell you why.'],
    ],
  },
  {
    h: 'Figures and AI answers',
    body: [
      ['AIBOS works out figures and answers from the records you give it. They are there to help you decide. They do not replace an accountant, a tax adviser or a lawyer, so check anything important before you rely on it, such as a tax return.'],
      ['AI answers can be wrong. We show where every figure comes from so that you can check it.'],
    ],
  },
  {
    h: 'The service',
    body: [
      ['We work to keep AIBOS running and your data safe, but we cannot promise it will never be interrupted.'],
      ['We improve and change features over time. If we take away something you pay for, we tell you before we do.'],
    ],
  },
  {
    h: 'Ending',
    body: [
      ['You can stop using AIBOS whenever you like. Cancel your plan’s renewal on Plan & billing and it ends at the end of the period you paid for.'],
      ['You can ask us to delete your account and your data at any time.'],
    ],
  },
  {
    h: 'Our responsibility',
    body: [
      ['As far as the law allows, we are not responsible for indirect losses such as lost profits. Our total responsibility to you is limited to what you paid us in the 12 months before the problem.'],
      ['Nothing in these terms takes away rights you have by law that cannot be taken away.'],
    ],
  },
  {
    h: 'Law and changes',
    body: [
      ['These terms are governed by the laws of Zambia.'],
      ['If we change these terms in a way that matters, we tell you in the app or by email before the change takes effect.'],
    ],
  },
];

export default function TermsPage() {
  return (
    <section className="mkt-section mkt-section--tight">
      <div className="mkt-wrap" style={{ maxWidth: 760 }}>
        <p className="mkt-eyebrow">Legal</p>
        <h1 className="mkt-h1" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.8rem)', marginBottom: 10 }}>Terms of Service</h1>
        <p className="mkt-lead" style={{ marginBottom: 8 }}>
          The agreement between you and {LEGAL.name}, in plain words. Last updated {LEGAL.termsUpdated}.
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', marginBottom: 40 }}>
          See also our <Link href="/refunds" style={{ color: 'var(--cyan)' }}>Refund Policy</Link> and <Link href="/privacy" style={{ color: 'var(--cyan)' }}>Privacy Policy</Link>.
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
