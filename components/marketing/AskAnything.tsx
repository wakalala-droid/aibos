import { Check } from 'lucide-react';
import { BrandMark } from '@/components/kit';
import Rise from '@/components/marketing/Rise';

// Ask AIBOS, on the kit's dark surface: the assistant's own panel (.ai-panel)
// with a question, the answer from the books and the follow-ups the app
// suggests. The answer is illustrative and the caption says so.
const VALUES = [
  'Answers from your own records, never a made-up trend',
  'Remembers the conversation, so “and July?” just works',
  'On Pro+, tell it about a sale and it records it',
];

const FOLLOW_UPS = ['And July?', 'Who owes me money?', 'How long will my cash last?'];

export default function AskAnything() {
  return (
    <section className="mkt-dark mkt-section" data-theme="dark" aria-labelledby="ask-h">
      <div className="mkt-wrap mkt-split">
        <div>
          <p className="mkt-eyebrow">Ask AIBOS</p>
          <h2 id="ask-h" className="mkt-h2">Ask the way you would ask a sharp employee.</h2>
          <p className="mkt-lead" style={{ marginTop: 20, maxWidth: 520 }}>
            No dashboards to learn and no formulas to write. Type a question and AIBOS answers
            from your own books in seconds. It answers in Kwacha and says where each figure came from.
          </p>
          <ul className="mkt-values">
            {VALUES.map((v) => (
              <li key={v}><Check aria-hidden />{v}</li>
            ))}
          </ul>
        </div>

        <figure className="ai-panel" style={{ margin: 0 }}>
          <Rise className="mkt-chat" mode="seq">
            <p className="mkt-chat-status">Reading last month’s sales · 14 products · 1,204 sales</p>
            <p className="mkt-chat-q">Which product made me the most money last month?</p>
            <div className="mkt-chat-from">
              <span className="bento-icon" aria-hidden="true"><BrandMark size={18} theme="dark" /></span>
              AIBOS
            </div>
            <p className="mkt-chat-a">
              Your grilled chicken platter made the most: <strong>K18,400 gross profit last month</strong>,
              about 22% of your profit across 14 products.
            </p>
            <p className="mkt-chat-a">
              Its margin slipped from 41% to 36% as chicken prices rose. Next move: <strong>raise its price
              by about K6 or agree a better poultry price</strong>, which brings back roughly K2,900 a month.
            </p>
            <div className="chips" aria-label="Questions AIBOS suggests next">
              {FOLLOW_UPS.map((q) => <span key={q} className="chip">{q}</span>)}
            </div>
            <figcaption className="mkt-preview-cap" style={{ margin: 0 }}>
              An illustration on a sample business. AIBOS answers only from your own records.
            </figcaption>
          </Rise>
        </figure>
      </div>
    </section>
  );
}
