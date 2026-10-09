import {
  PenLine, Wallet, ReceiptText, UserRound, CalendarClock, Briefcase, BedDouble, Building2,
} from 'lucide-react';
import { BentoCard } from '@/components/kit';
import Rise from '@/components/marketing/Rise';

// Every part of AIBOS a business runs on, as the kit's bento grid. The tag on
// each card is the plan it comes with (lib/tiers.ts is the truth: keep these
// in step with what each plan unlocks).

const RECEIPT = [
  ['Cooking oil, 20 litres', 'K1,150.00'],
  ['Chicken, 10 kg', 'K890.00'],
  ['Charcoal, 2 bags', 'K160.00'],
] as const;

export default function FeatureBento() {
  return (
    <section id="features" className="mkt-section" aria-labelledby="features-h" style={{ scrollMarginTop: 72 }}>
      <div className="mkt-wrap">
        <Rise className="mkt-head">
          <div>
            <p className="mkt-eyebrow">Everything in one place</p>
            <h2 id="features-h" className="mkt-h2">The whole business, in one app.</h2>
          </div>
          <p className="mkt-head-sub">
            Every part of AIBOS and the plan it comes with. Free runs the day-to-day.
            The paid plans add the thinking.
          </p>
        </Rise>

        <Rise className="bento-grid" mode="stagger">
          <BentoCard
            className="span-4 rows-2"
            icon={<PenLine />}
            title="Record"
            tag="Free"
            text="A sale, an expense or a payment in three taps. Snap a receipt or drop in a spreadsheet and AIBOS reads it, asking one question at a time about anything only you know."
          >
            <div style={{ marginTop: 16 }}>
              {RECEIPT.map(([what, amount]) => (
                <div key={what} className="row" style={{ minHeight: 44 }}>
                  <span className="row-main"><span className="row-title" style={{ fontWeight: 500 }}>{what}</span></span>
                  <span className="row-amount">{amount}</span>
                </div>
              ))}
              <div className="row" style={{ minHeight: 44 }}>
                <span className="row-main"><span className="row-title">Total</span></span>
                <span className="row-amount">K2,200.00</span>
              </div>
            </div>
            <p className="mkt-preview-cap" style={{ marginTop: 10 }}>Read from a photo of a supplier&apos;s receipt. Check it, then save.</p>
          </BentoCard>

          <BentoCard
            className="span-2"
            icon={<Wallet />}
            title="Money"
            tag="Free"
            text="Profit and cash at a glance. See where your money is: cash, mobile money and bank, adding up to one figure."
          />
          <BentoCard
            className="span-2"
            icon={<ReceiptText />}
            title="Get paid"
            tag="Free"
            text="Invoices with a payment link. Your customer pays by mobile money and the invoice marks itself paid."
          />

          <BentoCard
            className="span-2"
            icon={<UserRound />}
            title="Customers and stock"
            tag="Free"
            text="Who buys, who owes and what is running low, with a reorder level on every item."
          />
          <BentoCard
            className="span-2"
            icon={<CalendarClock />}
            title="Schedule"
            tag="Free"
            text="Meetings, pick-ups, deliveries and tax deadlines in one list. With Pro, the reminder comes to your phone."
          />
          <BentoCard
            className="span-2"
            icon={<Briefcase />}
            title="Staff and payroll"
            tag="Pro"
            text="A staff register on every plan. Pro works out PAYE, NAPSA, NHIMA and take-home pay, then posts the wages."
          />

          <BentoCard
            className="span-3"
            icon={<BedDouble />}
            title="Rooms & Stays"
            tag="Pro"
            text="For lodges and short lets: a week calendar, bookings, deposits and a payment link for every guest, with a reminder before they arrive."
          />
          <BentoCard
            className="span-3"
            icon={<Building2 />}
            title="Several businesses"
            tag="Growth"
            text="A shop, a salon and a lodge under one login, each with its own books. Switch between them in one tap."
          />
        </Rise>
      </div>
    </section>
  );
}
