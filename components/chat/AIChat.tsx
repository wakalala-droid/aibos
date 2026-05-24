'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';

// ─── Icons ────────────────────────────────────────────────────────────────────

const SendIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9 22,2"/>
  </svg>
);
const BotIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <path d="M12 11V6"/><circle cx="12" cy="4" r="2"/>
    <line x1="8" y1="15" x2="8" y2="15"/><line x1="16" y1="15" x2="16" y2="15"/>
  </svg>
);

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What drove the September cost spike?',
  "What's our cash runway forecast?",
  'Which months had margin compression?',
  "What's causing Q3 underperformance?",
  'Summarise our financial health',
  "What's the revenue forecast for next quarter?",
];

// ─── AI response generator (client-side mock; replace with API call) ──────────

interface Message {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: Date;
}

async function getAIResponse(question: string, userId: string, pnl: any, alerts: any[]): Promise<string> {
  try {
    const { sendChatMessage } = await import('@/lib/api');
    const result = await sendChatMessage({
      question,
      user_id: userId,
      pnl,
      alerts,
      persist: true,
    });
    return result.answer;
  } catch (e) {
    console.error('[AIChat] API error:', e);
    return generateFallback(question, pnl);
  }
}

function generateFallback(question: string, kpi: any): string {
  const q = question.toLowerCase();
  if (q.includes('september') || q.includes('cost spike') || q.includes('sep')) {
    return `In September, operating costs reached ${formatCurrency(152000, true)} — a 34% overshoot vs the expected ${formatCurrency(113000, true)}. This pushed net margin to 22.8%, the lowest of the year (z-score: 3.8σ, flagged as critical). The most likely cause is a one-off operational event. I'd recommend investigating vendor invoices and payroll anomalies for that month.`;
  }
  if (q.includes('runway') || q.includes('cash')) {
    return `Current cash position is ~$890K with a monthly burn rate of $63.5K. At this rate, runway is 14 months — below the 18-month target. However, Q4 revenue growth (+18.4% YoY) projects improving cash inflows. Forecast shows cash growing to ~$1.48M by June if the growth trajectory holds.`;
  }
  if (q.includes('margin') || q.includes('compression')) {
    return `Margin compression is most severe in Q3: June (26.1%), September (22.8%), and April (27.6%). The key driver is costs growing faster than revenue in those months. Q4 has recovered strongly — October and November both achieved ~34-36% margins. The YTD average is 32.4%, tracking above the 30% target.`;
  }
  if (q.includes('q3') || q.includes('underperform')) {
    return `Q3 (July–September) averaged 29.6% margin vs Q2's 32.2% — a 2.6pp decline. September was the outlier (22.8% margin, cost spike of +34%). July and August performed well at 32–33%. Q3 revenue actually grew to $619K (Q2: $528K), but costs grew proportionally faster at $435K vs Q2's $369K.`;
  }
  if (q.includes('health') || q.includes('summar')) {
    return `Financial health score: 78/100 (Healthy). Revenue grew 18.4% YoY to ${formatCurrency(kpi.totalRevenue, true)}. Net profit: ${formatCurrency(kpi.netProfit, true)} at a 32.4% avg margin. ${kpi?.varianceAlerts ?? 0} variance alerts active. Main risks: cost spikes and cash runway. Q4 momentum is strong.`;
  }
  if (q.includes('forecast') || q.includes('next quarter') || q.includes('revenue')) {
    return `Based on the Q4 trajectory (+18.4% YoY), Q1 next year is forecast at $281K–$307K revenue (midpoint $294K). The 3-month forward forecast shows continued growth: Jan $281K → Feb $296K → Mar $314K. Confidence interval widens at 90 days. Key risk: cost management — if costs track September levels, margin could compress to 26%.`;
  }
  return `Based on your data: Revenue is ${formatCurrency(kpi?.totalRevenue ?? 0, true)} with ${kpi?.avgMargin ?? 0}% avg margin. Ask me about cash flow, variance, margins, or forecasting.`;
}

// ─── Typing animation ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 4px' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa' }}
        />
      ))}
    </div>
  );
}

// ─── Chat Component ───────────────────────────────────────────────────────────

interface AIChatProps {
  compact?: boolean;
}

export function AIChat({ compact = false }: AIChatProps) {
  const { user } = useAuth();
  const kpi    = useStore(s => s.kpi);
  const alerts = useStore(s => s.alerts);

  const [messages, setMessages]   = useState<Message[]>([
    {
      id: '0', role: 'assistant', timestamp: new Date(),
      content: `Hello! I'm your AI CFO. I've analysed your 12-month financial data. Revenue is up 18.4% YoY with a 32.4% average margin. I've flagged ${alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length} high-priority alerts. What would you like to explore?`,
    },
  ]);
  const [input, setInput]         = useState('');
  const [thinking, setThinking]   = useState(false);
  const [streaming, setStreaming] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming, thinking]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || thinking) return;

    const userMsg: Message = {
      id: Date.now().toString(), role: 'user', content: text.trim(), timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    // Get response from API (or fallback)
    let response: string;
    try {
      response = await getAIResponse(text, user?.id ?? 'anonymous', kpi, alerts);
    } catch {
      response = generateFallback(text, kpi);
    }
    setThinking(false);

    // Stream the response character by character for UX
    setStreaming('');
    for (let i = 0; i < response.length; i++) {
      await new Promise(r => setTimeout(r, 10 + Math.random() * 6));
      setStreaming(response.slice(0, i + 1));
    }

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    setStreaming('');
  }, [thinking, kpi, alerts]);

  const height = compact ? 320 : 480;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background:   'rgba(9,13,30,0.72)',
        backdropFilter: 'blur(16px)',
        border:       '1px solid rgba(99,179,237,0.12)',
        borderRadius: 16,
        display:      'flex',
        flexDirection:'column',
        height:       height,
        boxShadow:    '0 4px 24px rgba(0,0,0,0.3)',
        position:     'relative',
        overflow:     'hidden',
      }}
    >
      {/* Top glow */}
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.3), transparent)', zIndex: 1 }} />

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(99,179,237,0.08)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#03060d', flexShrink: 0 }}>
          <BotIcon />
        </div>
        <div>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>AI CFO</p>
          <p style={{ fontSize: '0.6rem', color: '#10b981', fontFamily: 'DM Mono, monospace', margin: 0 }}>● Online · Analysing your data</p>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,179,237,0.15) transparent' }}>

        {/* Suggested questions (only show if just the welcome message) */}
        {messages.length === 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {SUGGESTIONS.slice(0, compact ? 3 : 6).map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                style={{
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 7, padding: '5px 10px', color: '#60a5fa', fontSize: '0.68rem',
                  fontFamily: 'DM Mono, monospace', cursor: 'pointer', textAlign: 'left',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.08)'; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
          >
            {msg.role === 'assistant' && (
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#03060d', flexShrink: 0, marginTop: 2 }}>
                <BotIcon />
              </div>
            )}
            <div style={{
              maxWidth: '80%',
              background: msg.role === 'user' ? 'rgba(59,130,246,0.15)' : 'rgba(99,179,237,0.06)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.3)' : 'rgba(99,179,237,0.12)'}`,
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
              padding: '10px 13px',
            }}>
              <p style={{ fontSize: '0.78rem', color: '#d4ddf0', fontFamily: 'Outfit, sans-serif', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </p>
              <p style={{ fontSize: '0.58rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace', margin: 0, marginTop: 4 }}>
                {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Thinking */}
        {thinking && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#03060d', flexShrink: 0 }}><BotIcon /></div>
            <div style={{ background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: '4px 12px 12px 12px', padding: '8px 12px' }}>
              <TypingDots />
            </div>
          </div>
        )}

        {/* Streaming */}
        {streaming && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#03060d', flexShrink: 0 }}><BotIcon /></div>
            <div style={{ maxWidth: '80%', background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: '4px 12px 12px 12px', padding: '10px 13px' }}>
              <p style={{ fontSize: '0.78rem', color: '#d4ddf0', fontFamily: 'Outfit, sans-serif', margin: 0, lineHeight: 1.6 }}>
                {streaming}
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>▊</motion.span>
              </p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(99,179,237,0.08)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Ask your AI CFO anything…"
          disabled={thinking || !!streaming}
          style={{
            flex: 1, background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.15)',
            borderRadius: 10, padding: '10px 14px', color: '#e2eeff', fontSize: '0.82rem',
            fontFamily: 'Outfit, sans-serif', outline: 'none', transition: 'border-color .18s',
          }}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(96,165,250,0.5)'}
          onBlur={e =>  (e.target as HTMLInputElement).style.borderColor = 'rgba(99,179,237,0.15)'}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || thinking || !!streaming}
          style={{
            width: 40, height: 40, borderRadius: 10, border: 'none',
            background: input.trim() ? 'linear-gradient(135deg,#60a5fa,#06b6d4)' : 'rgba(99,179,237,0.1)',
            color: input.trim() ? '#03060d' : '#4a6285',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            transition: 'all .18s', flexShrink: 0,
          }}
        >
          <SendIcon />
        </button>
      </div>
    </motion.div>
  );
}
