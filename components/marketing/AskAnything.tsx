'use client';

import { motion, useReducedMotion } from 'framer-motion';

// The answer is staged line-by-line for a "thinking → answering" feel.
// Content is illustrative; the caption keeps the no-fabrication promise honest.
const ANSWER_LINES = [
  { text: 'Your Grilled Chicken Platter made the most: ', strong: 'K18,400 gross profit in May' },
  { text: ', about 22% of your total profit across 14 products.', strong: '' },
  { text: 'But its margin slipped from 41% to 36% as chicken prices rose.', strong: '', muted: true },
  { text: 'Next move: ', strong: 'raise its price by ~K6 or renegotiate poultry supply', after: ', which recovers roughly K2,900 a month.' },
];

export default function AskAnything() {
  const reduce = useReducedMotion();

  return (
    <section className="mkt-dark mkt-section" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="mkt-wrap mkt-2col" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 'clamp(28px, 5vw, 56px)', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        {/* Copy */}
        <div>
          <p className="mkt-eyebrow" style={{ color: 'var(--cyan)' }}>Your everyday genius</p>
          <h2 className="mkt-h2">Ask your business anything.</h2>
          <p className="mkt-lead" style={{ marginTop: 18 }}>
            No dashboards to learn, no formulas to write. Type a question the way
            you’d ask a sharp employee, and your AI CFO answers from your own numbers
            in seconds.
          </p>
          <ul style={{ listStyle: 'none', margin: '24px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Reads straight from the files you upload', 'Shows its working and never invents a trend', 'Answers in plain English, priced in Kwacha'].map((t) => (
              <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-2)', fontSize: '0.92rem' }}>
                <span aria-hidden style={{ color: 'var(--cyan)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Chat card */}
        <motion.div
          className="mkt-card"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ padding: 'clamp(18px, 2.4vw, 26px)' }}
        >
          {/* manifest chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 50, background: 'var(--good)' }} aria-hidden />
            Reading sales_may.xlsx · 14 products · 1,204 rows
          </div>

          {/* question bubble */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <p style={{ margin: 0, maxWidth: '85%', background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)', color: 'var(--text-1)', padding: '10px 14px', borderRadius: '14px 14px 4px 14px', fontSize: '0.92rem', fontWeight: 600 }}>
              Which product made me the most money last month?
            </p>
          </div>

          {/* answer */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span aria-hidden style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, var(--cyan), #a78bfa)', display: 'grid', placeItems: 'center', color: '#04222c', fontWeight: 900, fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>AI</span>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.62, color: 'var(--text-2)' }}>
              {ANSWER_LINES.map((line, i) => (
                <motion.span
                  key={i}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.55, ease: 'easeOut' }}
                  style={{ display: 'inline' }}
                >
                  {line.text}
                  {line.strong && <strong style={{ color: 'var(--text-1)', fontWeight: 800 }}>{line.strong}</strong>}
                  {line.after}{' '}
                </motion.span>
              ))}
            </p>
          </div>

          <p style={{ margin: '18px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-4)', textAlign: 'right' }}>
            Illustrative. AI-BOS answers only from your own uploaded data.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
