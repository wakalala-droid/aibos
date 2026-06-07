'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Quick prompts (matching image 2 exactly)
// ---------------------------------------------------------------------------

const QUICK_PROMPTS = [
  "What drove the September cost spike?",
  "What's our cash runway forecast?",
  "Which months had margin compression?",
  "What's causing Q3 underperformance?",
  "Summarise our financial health",
  "What's the revenue forecast for next quarter?",
];

// ---------------------------------------------------------------------------
// API base
// ---------------------------------------------------------------------------

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api/proxy'
    : 'http://localhost:8000');

// ---------------------------------------------------------------------------
// Timestamp helper
// ---------------------------------------------------------------------------

function nowTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ---------------------------------------------------------------------------
// Send icon
// ---------------------------------------------------------------------------

function SendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AICFOChat() {
  const { kpi, health, alerts, monthly, currencySymbol, pnl: storePnl } = useStore();
  const sym     = currencySymbol || 'K';
  const userId  = 'default-user';

  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [initialized, setInit]      = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Build greeting once on mount
  useEffect(() => {
    if (initialized) return;
    setInit(true);

    const avgMargin  = kpi?.avgMargin ?? 0;
    const alertCount = Array.isArray(alerts) ? alerts.filter((a: any) => a.severity === 'critical' || a.severity === 'warning').length : 0;

    const greeting: Message = {
      id:        'init',
      role:      'assistant',
      content:   `Hello! I'm your AI CFO. I've analysed your 12-month financial data. ` +
                 `Revenue is up with a ${avgMargin.toFixed(1)}% average margin. ` +
                 `I've flagged ${alertCount} high-priority alert${alertCount !== 1 ? 's' : ''}. ` +
                 `What would you like to explore?`,
      timestamp: nowTime(),
    };
    setMessages([greeting]);
  }, [initialized, kpi, alerts]);

  // Auto-scroll to bottom — but NOT on mount (per design rules)
  useEffect(() => {
    if (messages.length > 1) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Build context for backend
  const buildContext = useCallback(() => ({
    pnl: {
      total_revenue: kpi?.totalRevenue ?? 0,
      total_costs:   kpi?.totalCosts   ?? 0,
      total_profit:  kpi?.totalProfit  ?? 0,
      avg_margin:    kpi?.avgMargin    ?? 0,
    },
    health_score:    health?.score    ?? 0,
    health_label:    health?.label    ?? '',
    alerts:          Array.isArray(alerts) ? alerts : [],
    currency_symbol: sym,
  }), [kpi, health, alerts, sym]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id:        `u-${Date.now()}`,
      role:      'user',
      content:   trimmed,
      timestamp: nowTime(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          user_id: userId,
          context: buildContext(),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const aiMsg: Message = {
        id:        `a-${Date.now()}`,
        role:      'assistant',
        content:   data.reply ?? 'No response received.',
        timestamp: nowTime(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errMsg: Message = {
        id:        `e-${Date.now()}`,
        role:      'assistant',
        content:   'Sorry, I encountered an error. Please check your connection and try again.',
        timestamp: nowTime(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, buildContext]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      height:         '100%',
      background:     'var(--bg-card)',
      borderRadius:   12,
      overflow:       'hidden',
      border:         '1px solid var(--border)',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding:      '20px 24px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink:   0,
      }}>
        <h2 style={{
          fontFamily:    'Inter, sans-serif',
          fontSize:      '1.1rem',
          fontWeight:    700,
          color:         'var(--text-1)',
          margin:        '0 0 4px',
          letterSpacing: '-0.02em',
        }}>
          AI CFO Assistant
        </h2>
        <p style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize:   '0.62rem',
          color:      'var(--text-4)',
          margin:     0,
        }}>
          Ask anything about your financial data
        </p>
      </div>

      {/* ── Chat body ───────────────────────────────────────────────────── */}
      <div style={{
        flex:       1,
        overflowY:  'auto',
        padding:    '20px 20px 12px',
        display:    'flex',
        flexDirection: 'column',
        gap:        4,
      }}>

        {/* AI CFO identity card */}
        <div style={{
          display:       'flex',
          alignItems:    'center',
          gap:           12,
          marginBottom:  20,
        }}>
          {/* Avatar */}
          <div style={{
            width:          40,
            height:         40,
            borderRadius:   '50%',
            background:     'linear-gradient(135deg, #0097b2, #00d4ff)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                stroke="white" strokeWidth="1.5" fill="none"/>
              <path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h4.5a1.5 1.5 0 010 3H9"
                stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              AI CFO
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }}
              />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--good)' }}>
                Online · Analysing your data
              </span>
            </div>
          </div>
        </div>

        {/* Quick prompts — shown only when no user messages yet */}
        {messages.filter(m => m.role === 'user').length === 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  style={{
                    padding:    '6px 12px',
                    borderRadius: 20,
                    border:     '1px solid var(--border-md)',
                    background: 'var(--bg-badge)',
                    cursor:     loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize:   '0.62rem',
                    color:      'var(--text-2)',
                    opacity:    loading ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cyan)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--cyan)';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-md)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)';
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                display:       'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom:  12,
              }}
            >
              <div style={{
                maxWidth:     '85%',
                background:   msg.role === 'user'
                  ? 'linear-gradient(135deg, #0097b2, #00d4ff)'
                  : 'var(--bg-badge)',
                border:       msg.role === 'user'
                  ? 'none'
                  : '1px solid var(--border)',
                borderRadius: msg.role === 'user'
                  ? '16px 16px 4px 16px'
                  : '16px 16px 16px 4px',
                padding:      '12px 16px',
              }}>
                <p style={{
                  fontFamily:  'Inter, sans-serif',
                  fontSize:    '0.82rem',
                  color:       msg.role === 'user' ? '#fff' : 'var(--text-2)',
                  lineHeight:  1.55,
                  margin:      '0 0 6px',
                  whiteSpace:  'pre-wrap',
                }}>
                  {msg.content}
                </p>
                <p style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize:   '0.55rem',
                  color:      msg.role === 'user'
                    ? 'rgba(255,255,255,0.55)'
                    : 'var(--text-4)',
                  margin:     0,
                  textAlign:  msg.role === 'user' ? 'right' : 'left',
                }}>
                  {msg.timestamp}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}
            >
              <div style={{
                background:   'var(--bg-badge)',
                border:       '1px solid var(--border)',
                borderRadius: '16px 16px 16px 4px',
                padding:      '12px 18px',
                display:      'flex',
                alignItems:   'center',
                gap:          5,
              }}>
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    style={{
                      width:        6,
                      height:       6,
                      borderRadius: '50%',
                      background:   'var(--text-4)',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div style={{
        padding:      '12px 16px 16px',
        borderTop:    '1px solid var(--border)',
        flexShrink:   0,
      }}>
        <div style={{
          display:      'flex',
          alignItems:   'flex-end',
          gap:          10,
          background:   'var(--bg-badge)',
          border:       '1px solid var(--border-md)',
          borderRadius: 12,
          padding:      '10px 12px 10px 16px',
          transition:   'border-color 0.15s ease',
        }}
          onFocus={() => {}}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask your AI CFO anything..."
            rows={1}
            disabled={loading}
            style={{
              flex:       1,
              background: 'transparent',
              border:     'none',
              outline:    'none',
              resize:     'none',
              fontFamily: 'Inter, sans-serif',
              fontSize:   '0.82rem',
              color:      'var(--text-1)',
              lineHeight: 1.5,
              maxHeight:  120,
              overflow:   'auto',
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width:          34,
              height:         34,
              borderRadius:   8,
              border:         'none',
              background:     input.trim() && !loading
                ? 'linear-gradient(135deg, #0097b2, #00d4ff)'
                : 'var(--border)',
              cursor:         input.trim() && !loading ? 'pointer' : 'not-allowed',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          input.trim() && !loading ? '#fff' : 'var(--text-4)',
              flexShrink:     0,
              transition:     'all 0.15s ease',
            }}
          >
            <SendIcon size={14} />
          </button>
        </div>
        <p style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize:   '0.55rem',
          color:      'var(--text-4)',
          textAlign:  'center',
          margin:     '8px 0 0',
        }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
