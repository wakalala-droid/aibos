'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import Reveal from './Reveal';
import { SceneDawn, SceneLedger, SceneUpload, SceneGoldenHour } from './story-scenes';

/**
 * The Chanda story — AI-BOS's hero-character narrative band (Humble's
 * "Today's Reality → The Shift" arc, told as four time-stamped chapters
 * about a Copperbelt mine-services owner). Painterly scenes live in
 * story-scenes.tsx; the chapter-3 chat follows the AskAnything pattern
 * (staged lines, honest "illustrative" caption — never fabricated product UI).
 */

// The answer Chanda gets, staged line-by-line like the AskAnything chat.
const CHAT_LINES = [
  { text: 'Your Kalulushi haulage contract made ', strong: 'K212,400 profit last quarter', after: ' — 64% of everything you earned.' },
  { text: 'The Chambishi quarry ran at a 6% margin: diesel there is up 18% since March while your rate card hasn’t moved.', strong: '', muted: true },
  { text: 'Next move: ', strong: 'reprice quarry loads by about K90 per trip', after: ' — or that contract runs at a loss by September.' },
];

function TimeChip({ children }: { children: string }) {
  return (
    <p className="story-time">
      <span className="dot" aria-hidden />
      {children}
    </p>
  );
}

export default function ChandaStory() {
  const reduce = useReducedMotion();

  return (
    <section className="mkt-section" style={{ position: 'relative' }}>
      <div className="mkt-wrap">
        {/* Section header */}
        <Reveal>
          <div style={{ maxWidth: 760, marginBottom: 'clamp(40px, 6vw, 72px)' }}>
            <p className="mkt-eyebrow">A story from the Copperbelt</p>
            <h2 className="mkt-h2">He can hear a tired engine a pit away.</h2>
            <p className="mkt-lead" style={{ marginTop: 18 }}>
              What he couldn’t hear was his margin slipping. This is Chanda’s story —
              and if you swap the tippers for tables or shelves, it’s probably yours.
            </p>
          </div>
        </Reveal>

        {/* Chapter 1 — 04:42, the pit */}
        <div className="mkt-showcase" style={{ marginBottom: 'clamp(56px, 8vw, 96px)' }}>
          <Reveal>
            <div>
              <TimeChip>Chapter one · 04:42 · The pit, Kitwe</TimeChip>
              <h3 className="mkt-h3" style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)' }}>The pit wakes before the sun.</h3>
              <p className="mkt-body" style={{ marginTop: 14, maxWidth: 460 }}>
                Chanda Mulenga has run Mulenga Mining Services for eleven years — two
                excavators, six tippers, thirty-four payslips, haulage contracts for the
                big mines and a small quarry of his own. He knows which machine is
                struggling by the sound it makes on the ramp. But ask him which of his
                three contracts made money last month, and he finds out the same way the
                bank does: too late.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="story-scene"><SceneDawn /></div>
          </Reveal>
        </div>

        {/* Chapter 2 — 21:15, the site office */}
        <div className="mkt-showcase reverse" style={{ marginBottom: 'clamp(56px, 8vw, 96px)' }}>
          <Reveal>
            <div>
              <TimeChip>Chapter two · 21:15 · The site office</TimeChip>
              <h3 className="mkt-h3" style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)' }}>The truth lives in an exercise book.</h3>
              <p className="mkt-body" style={{ marginTop: 14, maxWidth: 460 }}>
                Diesel is paid for in cash every morning. The biggest client pays in
                sixty days. Payday never moves from the 25th. Holding all of it
                together: two exercise books, a nephew’s spreadsheet, and whatever the
                fuel man remembers.
              </p>
              <ul className="mkt-values" style={{ marginTop: 20 }}>
                {[
                  'A good month and a bad month feel identical until the bank balance says otherwise',
                  'New contracts get quoted on gut, because the real cost per trip is a mystery',
                  'Diesel creeps up a few ngwee at a time — invisible until the margin is gone',
                ].map((t) => (
                  <li key={t}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 8v5M12 16.5v.5" stroke="var(--warn)" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="12" r="9" stroke="var(--warn)" strokeWidth="2" /></svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="story-scene"><SceneLedger /></div>
          </Reveal>
        </div>

        {/* Chapter 3 — Sunday 19:40, the shift */}
        <div className="mkt-showcase" style={{ marginBottom: 'clamp(56px, 8vw, 96px)' }}>
          <Reveal>
            <div>
              <TimeChip>Chapter three · Sunday, 19:40 · Home</TimeChip>
              <h3 className="mkt-h3" style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)' }}>One upload. One question.</h3>
              <p className="mkt-body" style={{ marginTop: 14, maxWidth: 460 }}>
                One Sunday evening, Chanda sends AI-BOS the nephew’s spreadsheets —
                fuel, payroll, invoices, weighbridge tickets. It reads every column,
                shows its working, and asks nothing else of him. Then he types the
                question he has carried for eleven years.
              </p>

              {/* The question and its answer — same staged pattern as the CFO chat */}
              <div className="mkt-card" style={{ marginTop: 24, padding: 'clamp(16px, 2vw, 22px)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                  <p style={{ margin: 0, maxWidth: '88%', background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)', color: 'var(--text-1)', padding: '9px 13px', borderRadius: '14px 14px 4px 14px', fontSize: '0.9rem', fontWeight: 600 }}>
                    Which of my contracts actually makes me money?
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span aria-hidden style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--cyan), #a78bfa)', display: 'grid', placeItems: 'center', color: '#04222c', fontWeight: 900, fontFamily: 'Geist, sans-serif', fontSize: '0.74rem' }}>AI</span>
                  <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-2)' }}>
                    {CHAT_LINES.map((line, i) => (
                      <motion.span
                        key={i}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.4 + i * 0.55, ease: 'easeOut' }}
                        style={{ display: 'inline', ...(line.muted ? { color: 'var(--text-3)' } : {}) }}
                      >
                        {line.text}
                        {line.strong && <strong style={{ color: 'var(--text-1)', fontWeight: 800 }}>{line.strong}</strong>}
                        {line.after}{' '}
                      </motion.span>
                    ))}
                  </p>
                </div>
                <p style={{ margin: '14px 0 0', fontFamily: 'Geist, sans-serif', fontSize: '0.64rem', color: 'var(--text-4)', textAlign: 'right' }}>
                  Illustrative. AI-BOS answers only from your own uploaded data.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="story-scene"><SceneUpload /></div>
          </Reveal>
        </div>

        {/* Chapter 4 — 17:58, golden hour. Full-width close. */}
        <Reveal>
          <div style={{ maxWidth: 900, marginInline: 'auto' }}>
            <div style={{ textAlign: 'center', maxWidth: 680, marginInline: 'auto', marginBottom: 32 }}>
              <TimeChip>Chapter four · 17:58 · Golden hour</TimeChip>
              <h3 className="mkt-h3" style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)' }}>
                The mine still runs on diesel and iron. The decisions run on numbers now.
              </h3>
              <p className="mkt-body" style={{ marginTop: 14 }}>
                The 25th stopped being a surprise — the cash warning comes three weeks
                early. The quarry got repriced. The day diesel spikes, Chanda knows by
                breakfast. He still walks the pit at dawn, because that’s who he is.
                He just walks it knowing.
              </p>
            </div>
            <div className="story-scene"><SceneGoldenHour /></div>
            <div style={{ textAlign: 'center', marginTop: 36 }}>
              <p className="mkt-lead" style={{ maxWidth: 560, marginInline: 'auto' }}>
                From a kitchen in Makeni to a pit in Kitwe — if your business makes
                numbers, AI-BOS can read them.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 26 }}>
                <Link href="/login" className="mkt-btn mkt-btn-primary">Write your own next chapter</Link>
                <Link href="/pricing" className="mkt-btn mkt-btn-secondary">See pricing</Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
