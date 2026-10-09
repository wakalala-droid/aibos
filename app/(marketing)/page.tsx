import type { Metadata } from 'next';
import { Smartphone, Users, Landmark, ShieldCheck } from 'lucide-react';
import Hero from '@/components/marketing/Hero';
import FeatureBento from '@/components/marketing/FeatureBento';
import AskAnything from '@/components/marketing/AskAnything';
import MorningBrief from '@/components/marketing/MorningBrief';
import ReportsBento from '@/components/marketing/ReportsBento';
import HowItWorks from '@/components/marketing/HowItWorks';
import StartFree from '@/components/marketing/StartFree';
import { BentoCard } from '@/components/kit';
import Rise from '@/components/marketing/Rise';

// The landing page, built from the AI-BOS UI kit (docs/AIBOS_UI_KIT.md): the
// same bento cards, notices, money figures, rows and pills as the app, so
// what a visitor sees here is what they get after signing up.

export const metadata: Metadata = {
  title: 'AIBOS · The brain behind every business',
  description:
    'Record sales, send invoices with a mobile money payment link and ask your business anything. AIBOS keeps your books, watches your cash and answers in Kwacha. Start free.',
  alternates: { canonical: '/' },
};

const BUILT_FOR = [
  { icon: <Smartphone />, title: 'Works on any phone', text: 'Put AIBOS on your home screen like an app, with shortcuts to record a sale, add a booking or ask a question. Reminders arrive even with it closed.' },
  { icon: <Users />, title: 'Your team, your rules', text: 'Invite staff to record sales and your accountant to read the books. Staff never see the money pages.' },
  { icon: <Landmark />, title: 'Zambian rules built in', text: 'Kwacha first. PAYE, NAPSA and NHIMA at current rates. ZRA and NAPSA deadlines go straight on your schedule.' },
  { icon: <ShieldCheck />, title: 'Your data stays yours', text: 'Export your full history on any plan, even after you cancel. Your numbers never train anyone’s AI.' },
];

export default function MarketingHome() {
  return (
    <>
      <Hero />
      <FeatureBento />
      <AskAnything />
      <MorningBrief />
      <ReportsBento />

      <HowItWorks />

      {/* Built for how you work */}
      <section className="mkt-section" aria-labelledby="built-h" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <Rise className="mkt-head">
            <div>
              <p className="mkt-eyebrow">Built for how you work</p>
              <h2 id="built-h" className="mkt-h2">Made for Zambian businesses, on the phone in your pocket.</h2>
            </div>
          </Rise>
          <Rise className="bento-grid" mode="stagger">
            {BUILT_FOR.map((b) => (
              <BentoCard key={b.title} className="span-3" icon={b.icon} title={b.title} text={b.text} />
            ))}
          </Rise>
        </div>
      </section>

      <StartFree
        id="start-h"
        title="Start free on your own numbers."
        text="Upgrade only when the value is obvious. Every payment has a 30-day money-back guarantee."
        note="Card, PayPal, Apple Pay or Google Pay. Cancel any time in two clicks."
      />
    </>
  );
}
