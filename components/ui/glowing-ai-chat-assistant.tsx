'use client';

// components/ui/glowing-ai-chat-assistant.tsx
// FloatingAiAssistant — a floating, brand-marked launcher for the AI CFO.
//
//  • Collapsed: a glowing circular button showing the AI-BOS mark (light / dark
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
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { TIERS } from '@/lib/tiers';
import { useAiAssistant, MAX_CHARS } from '@/lib/aiAssistant';
import { DEFAULT_PROMPTS } from '@/lib/aiKnowledge';

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

// ── Tiny markdown-ish renderer for **bold** + bullet lines ───────────────────
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} style={{ margin: '0 0 2px', lineHeight: 1.55, color: 'var(--text-2)' }}>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**') ? (
                <strong key={j} style={{ fontWeight: 700, color: 'var(--text-1)' }}>{p.slice(2, -2)}</strong>
              ) : (
                <span key={j}>{p}</span>
              )
            )}
          </p>
        );
      })}
    </>
  );
}

export function FloatingAiAssistant() {
  const {
    open, setOpen, toggle,
    messages, loading, online, suggestions, setSuggestions,
    sendMessage, pushAssistant,
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
  }, [messages, loading]);

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
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
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

  const onAttach = useCallback(() => {
    const el = document.getElementById('upload-section');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setOpen(false); }
    else pushAssistant('Open the Overview page and use **Upload & Analyse** to bring in a CSV or Excel file — month, revenue and cost columns to start.');
  }, [setOpen, pushAssistant]);

  const tierMeta = TIERS[tier] ?? TIERS.free;
  const paid = tier !== 'free';
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); }
  };

  const mark = isDark ? '/brand/aibos-mark-dark.png' : '/brand/aibos-mark-light.png';
  const hasUserMsg = messages.some((m) => m.role === 'user');

  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 900, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14, pointerEvents: 'none' }}>
      {/* ── Panel ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-label="Ask me anything — AI CFO"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
            style={{
              pointerEvents: 'auto',
              width: 'min(420px, calc(100vw - 32px))',
              height: 'min(620px, calc(100vh - 132px))',
              display: 'flex', flexDirection: 'column',
              background: 'color-mix(in srgb, var(--bg-card) 88%, transparent)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border-md)', borderRadius: 16,
              boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,212,255,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <motion.span
                  animate={{ opacity: [1, 0.45, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: online ? 'var(--good)' : 'var(--warn)', flexShrink: 0, boxShadow: online ? '0 0 8px var(--good)' : 'none' }}
                />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>Ask me anything</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-3)', border: '1px solid var(--border-md)', borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap' }}>
                  AI CFO
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', fontWeight: 700, borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap',
                  color: paid ? '#fff' : 'var(--text-3)',
                  background: paid ? 'linear-gradient(135deg, #0097b2, #00d4ff)' : 'var(--bg-badge)',
                  border: paid ? 'none' : '1px solid var(--border-md)',
                }}>
                  {tierMeta.name}
                </span>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant"
                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>
                  {Icon.close}
                </button>
              </div>
            </div>

            {/* Body */}
            <div ref={scrollRef} onScroll={onBodyScroll} role="log" aria-live="polite" aria-label="Conversation"
              style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {!hasUserMsg && messages.length === 0 && (
                <div style={{ margin: 'auto 0', paddingTop: 8 }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.18rem', fontWeight: 600, lineHeight: 1.4, color: 'var(--text-3)', margin: '0 0 6px' }}>
                    What would you like to explore today?
                  </p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-4)', margin: 0 }}>
                    Ask about any number on your dashboard — or <strong style={{ color: 'var(--cyan)', fontWeight: 600 }}>long-press any card</strong> and I&apos;ll explain what it is and why it matters.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '88%',
                      background: m.role === 'user' ? 'linear-gradient(135deg, #0097b2, #00d4ff)' : 'var(--bg-badge)',
                      border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                      borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      padding: '11px 14px',
                      fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                    }}>
                      {m.role === 'assistant'
                        ? <RichText text={m.content} />
                        : <p style={{ margin: 0, lineHeight: 1.55, color: '#fff' }}>{m.content}</p>}
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', margin: '5px 0 0', textAlign: m.role === 'user' ? 'right' : 'left', color: m.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-4)' }}>
                        {m.timestamp}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: 'var(--bg-badge)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', display: 'flex', gap: 5 }}>
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-4)' }} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Suggested prompts */}
              {suggestions.length > 0 && !loading && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 2 }}>
                  {suggestions.map((p) => (
                    <button key={p} type="button" onClick={() => submit(p)}
                      style={{ padding: '6px 11px', borderRadius: 16, border: '1px solid var(--border-md)', background: 'var(--bg-badge)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: 'var(--text-2)', transition: 'all 0.15s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--text-2)'; }}>
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div style={{ padding: '12px 14px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-badge)', border: '1px solid var(--border-md)', borderRadius: 12, padding: '12px 12px 10px' }}>
                <label htmlFor="ai-assistant-input" className="sr-only">Ask the AI CFO</label>
                <textarea id="ai-assistant-input" ref={inputRef} value={input} rows={2}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))} onKeyDown={handleKey}
                  placeholder="Ask anything, or long-press a card to learn about it…"
                  maxLength={MAX_CHARS} disabled={loading}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: 'Inter, sans-serif', fontSize: '0.84rem', color: 'var(--text-1)', lineHeight: 1.5, maxHeight: 110, overflow: 'auto' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ToolBtn label="Attach data" onClick={onAttach}>{Icon.attach}</ToolBtn>
                    <ToolBtn label="Suggested questions" onClick={() => setSuggestions(DEFAULT_PROMPTS)}>{Icon.spark}</ToolBtn>
                    {speechSupported && (
                      <ToolBtn label={listening ? 'Stop voice input' : 'Voice input'} onClick={toggleVoice} active={listening}>{Icon.mic}</ToolBtn>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: input.length > MAX_CHARS * 0.9 ? 'var(--warn)' : 'var(--text-4)' }}>
                      {input.length}/{MAX_CHARS}
                    </span>
                    <button type="button" onClick={() => submit(input)} disabled={!input.trim() || loading} aria-label="Send message"
                      style={{ width: 38, height: 38, borderRadius: 10, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: input.trim() && !loading ? 'linear-gradient(135deg, #0097b2, #00d4ff)' : 'var(--border)',
                        color: input.trim() && !loading ? '#fff' : 'var(--text-4)',
                        cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.15s ease' }}>
                      {Icon.send}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'var(--text-4)' }}>
                  Press <kbd style={{ fontFamily: 'JetBrains Mono, monospace', background: 'var(--bg-badge)', border: '1px solid var(--border-md)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-3)' }}>Shift + Enter</kbd> for new line
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: online ? 'var(--good)' : 'var(--warn)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: online ? 'var(--good)' : 'var(--warn)' }} />
                  {online ? 'All systems operational' : 'Reconnecting…'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating launcher ──────────────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
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
          background: isDark ? '#0b1220' : '#e6e4de',
          boxShadow: '0 0 0 1px rgba(0,212,255,0.35), 0 0 22px rgba(0,212,255,0.35), 0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}
              style={{ color: isDark ? '#fff' : '#0b1220', display: 'flex' }}>
              {Icon.close}
            </motion.span>
          ) : (
            <motion.span key="logo" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }} style={{ display: 'flex' }}>
              <Image src={mark} alt="AI-BOS" width={62} height={62} style={{ width: 62, height: 62, objectFit: 'cover' }} priority />
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
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: active ? 'color-mix(in srgb, var(--crit) 18%, transparent)' : 'transparent',
        color: active ? 'var(--crit)' : 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.color = 'var(--text-1)'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; } }}>
      {children}
    </button>
  );
}

export default FloatingAiAssistant;
