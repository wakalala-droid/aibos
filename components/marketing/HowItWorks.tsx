import { Upload, MessageCircle, LayoutGrid } from 'lucide-react';
import { BentoCard } from '@/components/kit';
import Rise from '@/components/marketing/Rise';

// From the first upload to the full picture, as three kit bento cards.
const STEPS = [
  { icon: <Upload />, title: 'Minutes', tag: 'Step 1', text: 'Record a sale or upload a spreadsheet and see your profit and cash read straight back to you.' },
  { icon: <MessageCircle />, title: 'An hour', tag: 'Step 2', text: 'Ask your first questions and turn on the brief that lands on your phone each morning.' },
  { icon: <LayoutGrid />, title: 'A day', tag: 'Step 3', text: 'Money, customers, stock and staff in one place, with reminders before anything is due.' },
];

export default function HowItWorks({ id = 'how' }: { id?: string }) {
  return (
    <section id={id} className="mkt-section" aria-labelledby={`${id}-h`} style={{ paddingTop: 0, scrollMarginTop: 72 }}>
      <div className="mkt-wrap">
        <Rise className="mkt-head">
          <div>
            <p className="mkt-eyebrow">How it works</p>
            <h2 id={`${id}-h`} className="mkt-h2">Live in a day, not a quarter.</h2>
          </div>
          <p className="mkt-head-sub">Effort from you: just your numbers. No IT project, no consultant and no migration.</p>
        </Rise>
        <Rise className="bento-grid" mode="stagger">
          {STEPS.map((s) => (
            <BentoCard key={s.title} className="span-2" icon={s.icon} title={s.title} tag={s.tag} text={s.text} />
          ))}
        </Rise>
      </div>
    </section>
  );
}
