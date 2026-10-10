import { ArrowRight } from 'lucide-react';
import Rise from '@/components/marketing/Rise';

// The owner's week, named plainly, with what AIBOS does instead. As the block
// comes into view each old job is struck through by the brand line and the
// answer rises in its place, one row after another (marketing.css, "Pain to
// promise"). Reduced motion or no script: the finished picture.
const ROWS = [
  ['Counting the till at midnight', 'Your day’s numbers waiting at 06:30'],
  ['Guessing what you made this month', 'Profit to the Kwacha, any time you ask'],
  ['Paying a NAPSA penalty again', 'A reminder days before every deadline'],
  ['Chasing customers who owe you', 'A mobile money link on every invoice'],
] as const;

export default function PainPromise() {
  return (
    <section className="mkt-section" aria-labelledby="why-h">
      <div className="mkt-wrap">
        <div className="mkt-pain-head">
          <p className="mkt-eyebrow">Why owners switch</p>
          <h2 id="why-h" className="mkt-h1">You started a business, not a bookkeeping job.</h2>
          <p className="mkt-lead" style={{ marginTop: 20 }}>
            Running a business in Zambia is hard enough. These are the jobs that keep owners up at night,
            and what AIBOS does instead.
          </p>
        </div>

        <Rise className="mkt-pain" mode="seq">
          {ROWS.map(([pain, promise]) => (
            <div key={pain} className="mkt-pain-row">
              <p className="mkt-pain-old"><span>{pain}</span></p>
              <ArrowRight className="mkt-pain-arrow" aria-hidden />
              <p className="mkt-pain-new">{promise}</p>
            </div>
          ))}
        </Rise>
      </div>
    </section>
  );
}
