import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How AIBOS collects, uses, stores and protects your business data — including financial records, payroll, and guest details — and the rights you have over it.',
  alternates: { canonical: '/privacy' },
};

// Plain-language privacy policy (audit item #100). Written to be read, not to
// hide behind legalese — matching the product's no-black-box promise. Reviewed
// against the data the product actually holds (events, payroll, hospitality
// guest PII with field encryption). This is a starting policy; a lawyer should
// review before enterprise contracts.
const SECTIONS: { h: string; body: string[] }[] = [
  {
    h: 'What we collect',
    body: [
      'Account details you give us: your name, email, business name, industry, currency, and (if you choose) a WhatsApp number for your brief.',
      'Business data you record or upload: sales, expenses, inventory, customers, suppliers, invoices, schedules, and any spreadsheets you import.',
      'Payroll data, if you use it: employee names, pay, and statutory figures (PAYE, NAPSA, NHIMA).',
      'Hospitality data, if you use it: guest names, contact details, and — encrypted at the field level before it is stored — guest ID numbers.',
      'Usage events: which features you open, so we can improve the product. Never the content of your records for advertising.',
    ],
  },
  {
    h: 'How we use it',
    body: [
      'To run the product for you: compute your P&L, cashflow, forecasts, briefs and recommendations from your own recorded data.',
      'To answer your questions: when you use the AI chat, the relevant figures are sent to our AI provider (Groq) solely to generate your answer. They are not used to train any model.',
      'To keep you informed: deliver the brief you asked for, by email or WhatsApp, if you opt in.',
      'We do NOT sell your data, and we do NOT use your business records to train AI models or to advertise to you.',
    ],
  },
  {
    h: 'Where it lives and how it is protected',
    body: [
      'Your data is stored on Supabase (PostgreSQL) with row-level security, so one business can never read another’s records.',
      'Access to the database uses a server-side key held only by our backend; the browser never holds it.',
      'Sensitive identifiers (guest ID numbers) are encrypted with a per-deployment key before they are written, so a database leak alone does not expose them.',
      'Connections use HTTPS/TLS. We apply security headers (HSTS, CSP, frame protection) to the web app.',
    ],
  },
  {
    h: 'Your team and roles',
    body: [
      'If you invite staff or an accountant, they act inside your business with the role you grant. Staff record entries that you confirm; accountants have read-only access. You can change or revoke their access at any time from your profile.',
    ],
  },
  {
    h: 'Your rights',
    body: [
      'Export: download your full history at any time, on any plan, including after you cancel.',
      'Deletion: you can start fresh (which archives then removes recorded events, recoverable for 30 days) or ask us to delete your account entirely.',
      'Correction: edit any recorded event; the change is kept in an audit trail.',
      'To exercise any right, or ask a question, contact us at the address below.',
    ],
  },
  {
    h: 'Retention',
    body: [
      'We keep your data for as long as your account is active. Reset/“start fresh” archives are retained for 30 days for recovery, then purged. If you delete your account, your data is removed within 30 days, except where we must retain records to meet a legal obligation.',
    ],
  },
  {
    h: 'Third parties we rely on',
    body: [
      'Supabase (authentication and database), Groq (AI question answering), Resend (email brief delivery, if enabled), and Meta WhatsApp Cloud API (WhatsApp brief and recording, if enabled). Each receives only what is needed to perform its function.',
    ],
  },
  {
    h: 'Data processing (for business customers)',
    body: [
      'When you record your customers’, suppliers’ or guests’ personal details in AIBOS, you are the data controller and AIBOS is your data processor. We process that data only on your instructions — to run the features you use — and never for our own purposes.',
      'We keep it confidential, apply the security measures described above (RLS isolation, field encryption for guest IDs, TLS), and do not transfer it to anyone except the sub-processors listed below, each bound to equivalent terms.',
      'On request we will help you meet your own obligations to the people whose data you hold — including access, correction, export and deletion — and we return or delete the data when you close your account. For a signed Data Processing Agreement, contact us.',
    ],
  },
  {
    h: 'Benchmarks and anonymised insights',
    body: [
      'In future, AIBOS may offer benchmark insights — e.g. “restaurants like yours run a 62% food margin.” Any such benchmarks are built ONLY from data that has been aggregated and anonymised so no individual business can be identified, and only from businesses that have explicitly opted in.',
      'This is off by default. We will ask for your clear consent before your (anonymised) figures ever contribute to a benchmark, and you can withdraw at any time. We never sell your data, benchmarked or otherwise.',
    ],
  },
  {
    h: 'Changes and contact',
    body: [
      'We will give notice before any material change to this policy. Questions or requests: reach us at the support address shown in the app, or via the business you signed up with.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <section className="mkt-section mkt-section--tight">
      <div className="mkt-wrap" style={{ maxWidth: 760 }}>
        <p className="mkt-eyebrow">Legal</p>
        <h1 className="mkt-h1" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.8rem)', marginBottom: 10 }}>Privacy Policy</h1>
        <p className="mkt-lead" style={{ marginBottom: 8 }}>
          Plain language, because you should be able to read it. Last updated 14 July 2026.
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', marginBottom: 40 }}>
          See also our <Link href="/trust" style={{ color: 'var(--cyan)' }}>Trust Center</Link> for the promises behind these mechanics.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {SECTIONS.map((s) => (
            <div key={s.h}>
              <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 12px' }}>{s.h}</h2>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.body.map((b, i) => (
                  <li key={i} style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.6 }}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
