'use client';

// components/ui/glowing-ai-chat-assistant.tsx
// FloatingAiAssistant — a floating, brand-marked launcher for the AI CFO.
//
//  • Collapsed: a glowing circular button showing the AIBOS mark (light / dark
//    variant for the active theme). Toggles to an X when open.
//  • Expanded: a glassy chat panel (status · model · tier · close, big prompt,
//    composer with attach / voice / send, char counter, footer).
//
// This is the SAME assistant as the embedded AI CFO panel (chat/AICFOChat) — the
// conversation is shared via AiAssistantProvider, so history persists between
// the floating launcher and the dashboard panel. Long-press any [data-ai-explain]
// card to have it explained instantly from the local knowledge base.

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { TIERS } from '@/lib/tiers';
import { useAiAssistant, MAX_CHARS } from '@/lib/aiAssistant';
import { DEFAULT_PROMPTS } from '@/lib/aiKnowledge';
import AnswerCheck from '@/components/chat/AnswerCheck';
import RichText from '@/components/chat/RichText';

// ── Minimal stroke icons (2px, per visual_language_system.md) ────────────────
const Icon = {
  send: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  attach: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3 3 0 014.24 4.24l-9.2 9.19a1 1 0 01-1.41-1.41l8.49-8.49" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  spark: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15l-1.6-4.2L6 9.2l4.4-1.6L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  mic: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
};

export function FloatingAiAssistant() {
  const router = useRouter();
  const {
    open, setOpen, toggle,
    messages, loading, status, online, suggestions, setSuggestions,
    sendMessage, pushAssistant, clearConversation,
  } = useAiAssistant();
  const { isDark } = useTheme();
  const tier = useStore((s) => s.tier);

  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const recognitionRef = useRef<any>(null);

  const submit = useCallback((text: string) => {
    if (!text.trim() || loading) return;
    atBottomRef.current = true;
    sendMessage(text);
    setInput('');
  }, [loading, sendMessage]);

  // Auto-scroll only when the user is already pinned to the bottom.
  useEffect(() => {
    if (messages.length && atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, status]);

  const onBodyScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);

  // Escape closes the panel (accessibility_system.md KEYBOARD RULE).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // ── Voice input (progressive enhancement) ──────────────────────────────────
  const speechSupported = typeof window !== 'undefined' && (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));
  const toggleVoice = useCallback(() => {
    if (!speechSupported) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    // Follow the device locale, same as RecordActivity (audit #17). This mic
    // was left on en-US when the Record page was fixed — a Nyanja or Bemba
    // speaker dictating into the floating assistant still got English.
    rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    rec.interimResults = true; rec.continuous = false;
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setInput(transcript.slice(0, MAX_CHARS));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, speechSupported]);

  // Attaching a file opens Upload a file, the one place files come in.
  const onAttach = useCallback(() => {
    setOpen(false);
    router.push('/dashboard/import');
  }, [setOpen, router]);

  const tierMeta = TIERS[tier] ?? TIERS.free;
  const paid = tier !== 'free';
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); }
  };

  const mark = isDark ? '/brand/aibos-mark-dark.png' : '/brand/aibos-mark-light.png';
  const hasUserMsg = messages.some((m) => m.role === 'user');

  return (
    <div className="ai-fab-wrap" style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 900, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14, pointerEvents: 'none' }}>
      {/* ── Panel ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-label="Ask AIBOS"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
            className="ai-panel-glass ai-panel"
            style={{
              pointerEvents: 'auto',
              width: 'min(440px, calc(100vw - 32px))',
              height: 'min(640px, calc(100vh - 132px))',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span className="bento-icon" aria-hidden="true" style={{ width: 44, height: 44 }}>{Icon.spark}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="bento-title" style={{ display: 'block' }}>Ask AIBOS</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: online ? 'var(--text-1)' : 'var(--text-4)', flexShrink: 0 }} />
                  {online ? 'Ready' : 'Reconnecting…'} · {tierMeta.name}
                </span>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={clearConversation} disabled={loading} className="pill pill-quiet"
                  title="Start a new conversation. AIBOS forgets this one.">
                  New chat
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="icon-pill">
                {Icon.close}
              </button>
            </div>

            {/* Body */}
            <div ref={scrollRef} onScroll={onBodyScroll} role="log" aria-live="polite" aria-label="Conversation"
              style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {!hasUserMsg && messages.length === 0 && (
                <div style={{ margin: 'auto 0', paddingTop: 8 }}>
                  <p className="eyebrow">Your business, answered</p>
                  <p style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25, color: 'var(--text-1)', margin: '0 0 8px' }}>
                    What would you like to know?
                  </p>
                  <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-3)', margin: 0 }}>
                    Ask about any number you see, or <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>hold your finger on any card</strong> and AIBOS explains what it is and why it matters.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '88%',
                      background: m.role === 'user' ? 'var(--text-1)' : 'var(--bg-card)',
                      border: m.role === 'user' ? 'none' : '1px solid var(--border-md)',
                      borderRadius: m.role === 'user' ? '16px 16px 6px 16px' : '16px 16px 16px 6px',
                      padding: '12px 16px',
                      fontSize: 'var(--fs-body)',
                    }}>
                      {m.role === 'assistant'
                        ? <RichText text={m.content} />
                        : <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--bg-card)' }}>{m.content}</p>}
                      <p style={{ fontSize: 'var(--fs-label)', margin: '5px 0 0', textAlign: m.role === 'user' ? 'right' : 'left', color: m.role === 'user' ? 'color-mix(in srgb, var(--bg-card) 75%, transparent)' : 'var(--text-4)' }}>
                        {m.timestamp}
                      </p>
                    </div>
                    {m.role === 'assistant' && m.reads !== undefined && !m.ephemeral && (
                      <AnswerCheck
                        message={m}
                        question={messages[i - 1]?.role === 'user' ? messages[i - 1].content : undefined}
                        settled={!(loading && i === messages.length - 1)}
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {status && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'flex-start' }}>
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

              {/* Suggested prompts */}
              {suggestions.length > 0 && !loading && (
                <div className="chips" style={{ marginTop: 4 }}>
                  {suggestions.map((p) => (
                    <button key={p} type="button" className="chip" onClick={() => submit(p)} style={{ whiteSpace: 'normal', textAlign: 'left' }}>
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div style={{ padding: '12px 14px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius-lg)', padding: '12px 12px 8px 16px', boxShadow: 'var(--shadow-card)' }}>
                <label htmlFor="ai-assistant-input" className="sr-only">Ask AIBOS</label>
                <textarea id="ai-assistant-input" ref={inputRef} value={input} rows={2}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))} onKeyDown={handleKey}
                  placeholder="Ask anything, or long-press a card to learn about it…"
                  maxLength={MAX_CHARS} disabled={loading}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--fs-body)', color: 'var(--text-1)', lineHeight: 1.5, maxHeight: 110, overflow: 'auto' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ToolBtn label="Attach data" onClick={onAttach}>{Icon.attach}</ToolBtn>
                    <ToolBtn label="Suggested questions" onClick={() => setSuggestions(DEFAULT_PROMPTS)}>{Icon.spark}</ToolBtn>
                    {speechSupported && (
                      <ToolBtn label={listening ? 'Stop voice input' : 'Voice input'} onClick={toggleVoice} active={listening}>{Icon.mic}</ToolBtn>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 'var(--fs-label)', color: input.length > MAX_CHARS * 0.9 ? 'var(--warn)' : 'var(--text-4)' }}>
                      {input.length}/{MAX_CHARS}
                    </span>
                    <button type="button" onClick={() => submit(input)} disabled={!input.trim() || loading} aria-label="Send message"
                      className="icon-pill"
                      style={input.trim() && !loading ? { background: 'var(--brand-fill)', color: 'var(--on-brand)' } : { cursor: 'not-allowed', color: 'var(--text-4)' }}>
                      {Icon.send}
                    </button>
                  </div>
                </div>
              </div>

              <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                <kbd style={{ border: '1px solid var(--border-md)', borderRadius: 'var(--radius-sm)', padding: '1px 6px', color: 'var(--text-2)', fontFamily: 'inherit' }}>Shift + Enter</kbd> for a new line
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating launcher ──────────────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Close Ask AIBOS' : 'Open Ask AIBOS'}
        aria-expanded={open}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        style={{
          pointerEvents: 'auto',
          width: 62, height: 62, borderRadius: '50%', border: 'none', cursor: 'pointer',
          padding: 0, position: 'relative', flexShrink: 0,
          background: isDark ? '#111112' : '#ffffff',
          boxShadow: '0 0 0 1px var(--border-strong), var(--shadow-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}
              style={{ color: 'var(--text-1)', display: 'flex' }}>
              {Icon.close}
            </motion.span>
          ) : (
            <motion.span key="logo" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }} style={{ display: 'flex' }}>
              <Image src={mark} alt="AIBOS" width={62} height={62} style={{ width: 62, height: 62, objectFit: 'cover' }} priority />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

// Small composer tool button.
function ToolBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={active || undefined}
      className="icon-pill" style={active ? { background: 'var(--text-1)', color: 'var(--bg-card)' } : { background: 'transparent' }}>
      {children}
    </button>
  );
}

export default FloatingAiAssistant;
