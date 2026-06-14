"use client";

// app/chat/page.tsx — AI CFO Chat
// Tag: "Ask Your Business Anything"
// Rich Groq context from uploaded data via cabinet_id

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const SUGGESTED = [
  "What's driving my highest revenue month?",
  "Where are my biggest cost risks?",
  "How does my profit margin compare to industry benchmarks?",
  "Give me a 3-month forecast based on my trends.",
  "What actions should I take to improve cash flow?",
  "Which months showed anomalies I should investigate?",
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-[var(--cyan)]"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[var(--cyan)]/10 border border-[var(--cyan)]/30 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M2 17l10 5 10-5" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M2 12l10 5 10-5" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--cyan)] text-[#000] font-medium rounded-br-sm"
            : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-1)] rounded-bl-sm"
        }`}
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        {msg.content.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            {i < msg.content.split("\n").length - 1 && <br />}
          </span>
        ))}
        <div
          className={`text-[10px] mt-1.5 opacity-50`}
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {new Date(msg.ts).toLocaleTimeString("en-ZM", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-[var(--cyan)] flex items-center justify-center ml-2 mt-1 flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" fill="#000"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </motion.div>
  );
}

export default function ChatPage() {
  const { cabinetId, filename, monthly, activeSheet, engine } = useFinancialStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll only on new messages — not on mount
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Quick financial summary for context badge
  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalProfit = monthly.reduce((s, m) => s + m.profit, 0);
  const avgMargin = monthly.length
    ? monthly.reduce((s, m) => s + m.margin, 0) / monthly.length
    : 0;

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || loading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        ts: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const payload = {
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          cabinet_id: cabinetId ?? undefined,
        };

        const res = await fetch("/api/proxy/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Server error ${res.status}`);
        }

        const data = await res.json();
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e) {
        const errStr = (e as Error).message;
        setError(errStr);
        // Surface error as assistant message too
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `I encountered an error: ${errStr}\n\nPlease check the server configuration (GROQ_API_KEY on Railway).`,
            ts: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, messages, loading, cabinetId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg-page)" }}>
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-6 py-4 border-b"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-card)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            {/* Primary tag — the headline */}
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--text-1)", fontFamily: "Inter, sans-serif" }}
            >
              Ask Your Business Anything
            </h1>
            <p
              className="text-xs mt-0.5"
              style={{
                color: "var(--text-3)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              AI CFO • {cabinetId ? `Analysing: ${filename}` : "No data loaded — upload a file to unlock insights"}
              {activeSheet && ` (${activeSheet})`}
            </p>
          </div>

          {/* Data context badge */}
          {cabinetId && monthly.length > 0 && (
            <div
              className="hidden md:flex items-center gap-4 px-4 py-2 rounded-xl border"
              style={{
                background: "var(--bg-page)",
                borderColor: "var(--border)",
              }}
            >
              <div className="text-center">
                <div
                  className="text-xs font-bold"
                  style={{ color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}
                >
                  {formatCurrency(totalRevenue)}
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
                  Revenue
                </div>
              </div>
              <div className="w-px h-8" style={{ background: "var(--border)" }} />
              <div className="text-center">
                <div
                  className="text-xs font-bold"
                  style={{
                    color: totalProfit >= 0 ? "var(--good)" : "var(--crit)",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {formatCurrency(totalProfit)}
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
                  Profit
                </div>
              </div>
              <div className="w-px h-8" style={{ background: "var(--border)" }} />
              <div className="text-center">
                <div
                  className="text-xs font-bold"
                  style={{
                    color: avgMargin >= 20 ? "var(--good)" : "var(--warn)",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {avgMargin.toFixed(1)}%
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
                  Avg Margin
                </div>
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-3)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Empty state */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center min-h-[50vh] text-center"
            >
              {/* Icon */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  background: "linear-gradient(135deg, var(--cyan)/15, var(--cyan)/5)",
                  border: "1.5px solid var(--cyan)/30",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M2 17l10 5 10-5" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M2 12l10 5 10-5" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>

              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: "var(--text-1)", fontFamily: "Inter, sans-serif" }}
              >
                Your AI CFO is ready
              </h2>
              <p
                className="text-sm mb-8 max-w-md leading-relaxed"
                style={{ color: "var(--text-3)" }}
              >
                {cabinetId
                  ? `I have your ${filename} data loaded. Ask me anything about your business performance, trends, risks, or opportunities.`
                  : "Upload your financial data to unlock deep business insights. Or ask me general Zambian business questions."}
              </p>

              {/* Suggested questions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                {SUGGESTED.map((q, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => sendMessage(q)}
                    className="text-left px-4 py-3 rounded-xl border text-sm transition-all hover:border-[var(--cyan)] hover:bg-[var(--cyan)]/5"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--bg-card)",
                      color: "var(--text-2)",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <span style={{ color: "var(--cyan)" }} className="mr-2">→</span>
                    {q}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Message list */}
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start mb-4"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--cyan)]/10 border border-[var(--cyan)]/30 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M2 17l10 5 10-5" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M2 12l10 5 10-5" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <div
                className="rounded-2xl rounded-bl-sm border"
                style={{
                  background: "var(--bg-card)",
                  borderColor: "var(--border)",
                }}
              >
                <TypingDots />
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Error strip ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-shrink-0 mx-4 mb-2 px-4 py-2 rounded-lg text-xs"
            style={{
              background: "var(--crit)/10",
              border: "1px solid var(--crit)/30",
              color: "var(--crit)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input area ── */}
      <div
        className="flex-shrink-0 px-4 pb-4 pt-2 md:px-8 border-t"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-end gap-3 rounded-2xl border p-2 transition-all focus-within:border-[var(--cyan)]"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-page)",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask your business anything… (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed py-1 px-2"
              style={{
                color: "var(--text-1)",
                fontFamily: "Inter, sans-serif",
                minHeight: "36px",
                maxHeight: "160px",
              }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: input.trim() && !loading ? "var(--cyan)" : "var(--bg-card)",
                border: "1px solid var(--border)",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                opacity: input.trim() && !loading ? 1 : 0.4,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                  stroke={input.trim() && !loading ? "#000" : "var(--text-3)"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <p
            className="text-center text-[10px] mt-2 opacity-40"
            style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
          >
            AI-BOS CFO • Powered by Groq llama-3.3-70b-versatile
            {cabinetId && " • Business data context active"}
          </p>
        </div>
      </div>
    </div>
  );
}
