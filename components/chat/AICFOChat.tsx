'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { logUsage } from '@/lib/usage';

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
// API base — ALWAYS go through the Next.js proxy in production.
// Calling the Railway backend directly from the browser causes CORS failures
// and returns HTML error pages (the "Unexpected token '<'" symptom).
// localhost dev still hits the local backend directly.
// ---------------------------------------------------------------------------

const API =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : '/api/proxy';

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
  const {
    kpi, health, alerts, monthly, currencySymbol,
    rfm, segments, clvTiers, retention,
    posGrandTotals, categories, topItems, benchmarks, attachRates,
    posBusinessName, posPeriod,
    hasEngine2Data, hasEngine3Data,
    intelligenceScores, crossInsights, unifiedBrief,
    cabinetId,
  } = useStore();
  const sym     = currencySymbol || 'K';
  const userId  = 'default-user';

  const safeRfm = useMemo(() => (Array.isArray(rfm) ? rfm : []), [rfm]);
  const hasFinancial = Array.isArray(monthly) && monthly.length > 0;
  const hasCustomer  = hasEngine2Data || safeRfm.length > 0;
  const hasOps       = hasEngine3Data || !!posGrandTotals;

  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [initialized, setInit]      = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Track whether the user is already pinned to the bottom; we only auto-scroll
  // when they are (motion_governance.md: never yank a user who scrolled up).
  const atBottomRef = useRef(true);

  // Build greeting once on mount
  useEffect(() => {
    if (initialized) return;
    setInit(true);

    const loaded: string[] = [];
    if (hasFinancial) {
      const avgMargin = kpi?.avgMargin ?? 0;
      loaded.push(`${monthly.length}-month financials (${avgMargin.toFixed(1)}% avg margin)`);
    }
    if (hasCustomer) loaded.push(`customer intelligence (${safeRfm.length} customers)`);
    if (hasOps) {
      const net = posGrandTotals?.net_revenue ?? posGrandTotals?.gross_revenue ?? 0;
      loaded.push(`operations data${net ? ` (${sym}${Math.round(net).toLocaleString()} sales)` : ''}`);
    }

    const content = loaded.length
      ? `Hello! I'm your AI CFO. I can see your ${loaded.join(', ')}. ` +
        `Ask me anything across Financial, Customer, and Operations intelligence.`
      : `Hello! I'm your AI CFO. Upload a financial, customer, or POS file and ` +
        `I'll analyse it for you. You can also ask general Zambian business questions.`;

    const greeting: Message = {
      id:        'init',
      role:      'assistant',
      content,
      timestamp: nowTime(),
    };
    setMessages([greeting]);
  }, [initialized, hasFinancial, hasCustomer, hasOps, kpi, monthly, safeRfm, posGrandTotals, sym]);

  // Auto-scroll to bottom — but NOT on mount, and only if the user is already
  // at the bottom (no forced scroll when they've scrolled up to read history).
  useEffect(() => {
    if (messages.length > 1 && atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages]);

  // Keep atBottomRef current as the user scrolls the transcript.
  const onBodyScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // Build context for backend — include EVERY engine that currently has data
  // so the AI CFO reasons across Financial + Customer + Operations, not just E1.
  const buildContext = useCallback(() => {
    const ctx: Record<string, unknown> = {
      currency_symbol: sym,
      cabinet_id:      cabinetId ?? undefined,
    };

    // ── Engine 1 · Financial ────────────────────────────────────────────────
    if (hasFinancial) {
      ctx.pnl = {
        total_revenue: kpi?.totalRevenue ?? 0,
        total_costs:   kpi?.totalCosts   ?? 0,
        total_profit:  kpi?.totalProfit  ?? 0,
        avg_margin:    kpi?.avgMargin    ?? 0,
      };
      ctx.health_score = health?.score ?? 0;
      ctx.health_label = health?.label ?? '';
      ctx.monthly = (Array.isArray(monthly) ? monthly : []).slice(0, 24);
    }
    if (Array.isArray(alerts) && alerts.length) ctx.alerts = alerts;

    // ── Engine 2 · Customer Intelligence ────────────────────────────────────
    if (hasCustomer) {
      const champions = safeRfm.filter(r => r.segment === 'Champion').length;
      const highChurn = safeRfm.filter(r => (r.churn_risk ?? 0) >= 70).length;
      ctx.customer = {
        total_customers: retention?.total_customers ?? safeRfm.length,
        champions,
        high_churn:      highChurn,
        retention_rate:  retention?.retention_rate ?? 0,
        segments:        Array.isArray(segments) ? segments : [],
        clv_tiers:       Array.isArray(clvTiers) ? clvTiers : [],
        top_customers:   [...safeRfm]
          .sort((a, b) => (b.clv ?? 0) - (a.clv ?? 0))
          .slice(0, 5)
          .map(r => ({
            id: r.customer_id, clv: r.clv, segment: r.segment, churn_risk: r.churn_risk,
          })),
      };
    }

    // ── Engine 3 · Operations / POS ─────────────────────────────────────────
    if (hasOps) {
      ctx.operations = {
        business_name: posBusinessName || undefined,
        period:        posPeriod || undefined,
        grand_totals:  posGrandTotals ?? undefined,
        categories:    (Array.isArray(categories) ? categories : []).slice(0, 12),
        top_items:     (Array.isArray(topItems) ? topItems : []).slice(0, 10).map(t => ({
          name: t.name, category: t.category, units_sold: t.units_sold, revenue: t.revenue,
        })),
        benchmarks:    Array.isArray(benchmarks) ? benchmarks : [],
        attach_rates:  attachRates ?? undefined,
      };
    }

    // ── Cross-engine intelligence ───────────────────────────────────────────
    const safeInsights = Array.isArray(crossInsights) ? crossInsights : [];
    if (intelligenceScores || safeInsights.length || unifiedBrief) {
      ctx.intelligence = {
        scores:         intelligenceScores ?? undefined,
        cross_insights: safeInsights.slice(0, 5).map(i => ({
          insight: i.insight, action: i.action, priority: i.priority,
        })),
        unified_brief:  unifiedBrief || undefined,
      };
    }

    return ctx;
  }, [
    sym, cabinetId, hasFinancial, hasCustomer, hasOps, kpi, health, monthly, alerts,
    safeRfm, segments, clvTiers, retention, posGrandTotals, categories, topItems,
    benchmarks, attachRates, posBusinessName, posPeriod, intelligenceScores,
    crossInsights, unifiedBrief,
  ]);

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
    logUsage('chat'); // fire-and-forget usage tracking
    // The user just sent — follow the conversation to the bottom.
    atBottomRef.current = true;

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

      // Read raw body first so an HTML error page doesn't throw a cryptic
      // JSON parse error — surface the real status instead.
      const raw = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        const snippet = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        throw new Error(
          res.ok
            ? `Non-JSON response from server. ${snippet}`.trim()
            : `Server error ${res.status}. ${snippet || 'The AI service may be offline.'}`.trim()
        );
      }

      if (!res.ok) {
        throw new Error(
          typeof data.detail === 'string' ? data.detail : `HTTP ${res.status}`
        );
      }

      const replyText =
        (data.reply as string) ?? (data.response as string) ?? 'No response received.';

      const aiMsg: Message = {
        id:        `a-${Date.now()}`,
        role:      'assistant',
        content:   replyText,
        timestamp: nowTime(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const detail = (err as Error).message || 'Unknown error';
      const errMsg: Message = {
        id:        `e-${Date.now()}`,
        role:      'assistant',
        content:   `Sorry, I hit an error: ${detail}`,
        timestamp: nowTime(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      // Keep focus in the composer after sending (accessibility_system.md
      // KEYBOARD RULE) — including after a quick-prompt button click.
      inputRef.current?.focus();
    }
  }, [loading, buildContext]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <section
      aria-label="AI CFO assistant"
      style={{
        display:        'flex',
        flexDirection:  'column',
        height:         '100%',
        background:     'var(--bg-card)',
        borderRadius:   12,
        overflow:       'hidden',
        border:         '1px solid var(--border)',
      }}
    >

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
      <div
        ref={scrollRef}
        onScroll={onBodyScroll}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Conversation with AI CFO"
        style={{
          flex:       1,
          overflowY:  'auto',
          padding:    '20px 20px 12px',
          display:    'flex',
          flexDirection: 'column',
          gap:        4,
        }}
      >

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
                  type="button"
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
                  fontSize:   '0.6rem',
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
          <label htmlFor="cfo-chat-input" className="sr-only">Message to AI CFO</label>
          <textarea
            id="cfo-chat-input"
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask your AI CFO anything..."
            aria-label="Message to AI CFO"
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
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            aria-label="Send message"
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
          fontSize:   '0.6rem',
          color:      'var(--text-4)',
          textAlign:  'center',
          margin:     '8px 0 0',
        }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </section>
  );
}
