'use client';

// components/chat/AICFOChat.tsx
// Embedded AI CFO panel on the dashboard. It shares ONE conversation with the
// floating launcher (glowing-ai-chat-assistant) via AiAssistantProvider — ask in
// either surface and the history shows in both.

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAiAssistant } from '@/lib/aiAssistant';
import RichText from '@/components/chat/RichText';
import AnswerCheck from '@/components/chat/AnswerCheck';

// Questions any business can ask of its own books. These used to assume facts
// from a demo ("What drove the September cost spike?"), which every real
// customer without a September spike was invited to ask about anyway.
const QUICK_PROMPTS = [
  "Summarise our financial health",
  "How long will our cash last?",
  "Where did most of our money go this month?",
  "Which months had the best margin?",
  "What should I watch this week?",
  "What's the revenue forecast for next quarter?",
];

function SendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AICFOChat() {
  const { messages, loading, status, sendMessage, clearConversation } = useAiAssistant();

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const submit = useCallback((text: string) => {
    if (!text.trim() || loading) return;
    atBottomRef.current = true;
    sendMessage(text);
    setInput('');
    inputRef.current?.focus();
  }, [loading, sendMessage]);

  // Auto-scroll only if the user is already pinned to the bottom.
  useEffect(() => {
    // Only the chat's own box scrolls. scrollIntoView moved the whole page,
    // so Home opened scrolled down to this panel whenever history loaded.
    const box = scrollRef.current;
    if (messages.length && atBottomRef.current && box) {
      box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, status]);

  const onBodyScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); }
  };

  const hasUserMsg = messages.some((m) => m.role === 'user');

  return (
    <section aria-label="Ask AIBOS" className="ai-panel" style={{ height: '100%', boxShadow: 'var(--shadow-card)' }}>
      {/* Header: the bento head, round mark, spaced-capital title, one tag. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span className="bento-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="bento-title">Ask AIBOS</h2>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: 0 }}>Answers from your own recorded figures</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clearConversation} disabled={loading} className="pill pill-quiet"
            title="Start a new conversation. AIBOS forgets this one.">
            New chat
          </button>
        )}
      </div>

      {/* Body */}
      <div ref={scrollRef} onScroll={onBodyScroll} role="log" aria-live="polite" aria-atomic="false" aria-label="Conversation with AIBOS"
        style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* Quick prompts — shown only when no user messages yet */}
        {!hasUserMsg && (
          <div style={{ marginBottom: 16 }}>
            <p className="eyebrow">Try asking</p>
            <div className="chips">
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" className="chip" onClick={() => submit(prompt)} disabled={loading}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <div style={{
                maxWidth: '85%',
                background: msg.role === 'user' ? 'var(--text-1)' : 'var(--bg-card)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-md)',
                borderRadius: msg.role === 'user' ? '16px 16px 6px 16px' : '16px 16px 16px 6px',
                padding: '12px 16px',
              }}>
                <div style={{ fontSize: 'var(--fs-body)', margin: '0 0 6px' }}>
                  {msg.role === 'assistant'
                    ? <RichText text={msg.content} />
                    : <p style={{ margin: 0, color: 'var(--bg-card)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</p>}
                </div>
                <p style={{ fontSize: 'var(--fs-label)', color: msg.role === 'user' ? 'color-mix(in srgb, var(--bg-card) 75%, transparent)' : 'var(--text-4)', margin: 0, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                  {msg.timestamp}
                </p>
              </div>
              {msg.role === 'assistant' && msg.reads !== undefined && !msg.ephemeral && (
                <AnswerCheck
                  message={msg}
                  question={messages[i - 1]?.role === 'user' ? messages[i - 1].content : undefined}
                  settled={!(loading && i === messages.length - 1)}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {status && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }}
              style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
              <div role="status" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: '16px 16px 16px 6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'flex', gap: 5 }} aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-4)', display: 'block' }} />
                  ))}
                </span>
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>{status}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius-lg)', padding: '8px 8px 8px 16px', boxShadow: 'var(--shadow-card)' }}>
          <label htmlFor="cfo-chat-input" className="sr-only">Message to AIBOS</label>
          <textarea
            id="cfo-chat-input" ref={inputRef} value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Ask AIBOS anything…" aria-label="Message to AIBOS" rows={1} disabled={loading}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--fs-body)', color: 'var(--text-1)', lineHeight: 1.5, maxHeight: 120, overflow: 'auto' }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }}
          />
          <button type="button" onClick={() => submit(input)} disabled={!input.trim() || loading} aria-label="Send message"
            className="icon-pill"
            style={input.trim() && !loading ? { background: 'var(--brand-fill)', color: 'var(--on-brand)' } : { cursor: 'not-allowed', color: 'var(--text-4)' }}>
            <SendIcon size={18} />
          </button>
        </div>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '8px 0 0' }}>
          Enter sends. Shift and Enter starts a new line.
        </p>
      </div>
    </section>
  );
}
