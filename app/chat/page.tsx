"use client";
// app/chat/page.tsx — AI CFO Chat
// Headline: "Ask Your Business Anything"
// Sends cabinet_id with every message so Groq has real business context

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialStore } from "@/lib/store";
import { formatCurrency } from "@/lib/currency";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const SUGGESTIONS = [
  "What's driving my highest revenue month?",
  "Where are my biggest cost risks?",
  "Give me a 3-month forecast based on current trends.",
  "Which months showed anomalies I should investigate?",
  "What's my breakeven revenue?",
  "How can I improve my profit margin?",
];

function Dots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "var(--cyan)" }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex mb-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center mr-2 mt-0.5 flex-shrink-0"
          style={{
            background: "rgba(0,212,255,0.1)",
            border: "1px solid rgba(0,212,255,0.25)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="var(--cyan)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
      <div
        className="max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
        style={
          isUser
            ? {
                background: "var(--cyan)",
                color: "#000",
                borderRadius: "18px 18px 4px 18px",
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
              }
            : {
                background: "var(--bg-card)",
                color: "var(--text-1)",
                border: "1px solid var(--border)",
                borderRadius: "18px 18px 18px 4px",
                fontFamily: "Inter, sans-serif",
              }
        }
      >
        {msg.content.split("\n").map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
        <div
          className="mt-1.5 text-[10px] opacity-40"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {new Date(msg.ts).toLocaleTimeString("en-ZM", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatPage() {
  const store = useFinancialStore();
  const cabinetId = store.cabinetId ?? null;
  const filename = store.filename ?? null;
  const monthly = store.monthly ?? [];
  const activeSheet = store.activeSheet ?? null;

  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll only when new messages arrive — NOT on mount
  useEffect(() => {
    if (msgs.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs.length]);

  const totalRev = monthly.reduce((s, m) => s + (m.revenue ?? 0), 0);
  const totalProfit = monthly.reduce((s, m) => s + (m.profit ?? 0), 0);
  const avgMargin =
    monthly.length > 0
      ? monthly.reduce((s, m) => s + (m.margin ?? 0), 0) / monthly.length
      : 0;

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || loading) return;

      const userMsg: Message = {
        id: Math.random().toString(36).slice(2),
        role: "user",
        content,
        ts: Date.now(),
      };
      setMsgs((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setError(null);

      // Reset textarea height
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      try {
        const payload = {
          messages: [...msgs, userMsg].map((m) => ({
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

        const data = (await res.json()) as {
          response?: string;
          detail?: string;
        };

        if (!res.ok) {
          throw new Error(data.detail ?? `Server error ${res.status}`);
        }

        setMsgs((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            role: "assistant",
            content: data.response ?? "(no response)",
            ts: Date.now(),
          },
        ]);
      } catch (e) {
        const errStr = (e as Error).message;
        setError(errStr);
        setMsgs((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            role: "assistant",
            content: `Error: ${errStr}\n\nCheck that GROQ_API_KEY is set in Railway environment variables.`,
            ts: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
        textareaRef.current?.focus();
      }
    },
    [input, msgs, loading, cabinetId]
  );

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "var(--bg-page)" }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 py-4 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--text-1)", fontFamily: "Inter, sans-serif" }}
            >
              Ask Your Business Anything
            </h1>
            <p
              className="text-[11px] mt-0.5"
              style={{
                color: "var(--text-3)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              AI CFO ·{" "}
              {cabinetId
                ? `${filename ?? "file"}${activeSheet ? ` (${activeSheet})` : ""} loaded`
                : "Upload a file to unlock business-specific insights"}
            </p>
          </div>

          {/* Live data badge */}
          {cabinetId && monthly.length > 0 && (
            <div
              className="hidden md:flex items-center gap-4 px-4 py-2 rounded-xl border"
              style={{
                background: "var(--bg-page)",
                borderColor: "var(--border)",
              }}
            >
              {[
                { label: "Revenue", value: formatCurrency(totalRev), color: "var(--cyan)" },
                {
                  label: "Profit",
                  value: formatCurrency(totalProfit),
                  color: totalProfit >= 0 ? "var(--good)" : "var(--crit)",
                },
                {
                  label: "Avg Margin",
                  value: `${avgMargin.toFixed(1)}%`,
                  color: avgMargin >= 20 ? "var(--good)" : "var(--warn)",
                },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-4">
                  {i > 0 && (
                    <div
                      className="w-px h-6"
                      style={{ background: "var(--border)" }}
                    />
                  )}
                  <div className="text-center">
                    <div
                      className="text-xs font-bold"
                      style={{
                        color: item.color,
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {item.value}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{ color: "var(--text-3)" }}
                    >
                      {item.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {msgs.length > 0 && (
            <button
              onClick={() => setMsgs([])}
              className="text-[11px] px-3 py-1.5 rounded-lg border"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          {msgs.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center min-h-[50vh] text-center"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(0,212,255,0.08)",
                  border: "1px solid rgba(0,212,255,0.2)",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="var(--cyan)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: "var(--text-1)", fontFamily: "Inter, sans-serif" }}
              >
                Your AI CFO is ready
              </h2>
              <p
                className="text-sm mb-8 max-w-md leading-relaxed"
                style={{ color: "var(--text-3)", fontFamily: "Inter, sans-serif" }}
              >
                {cabinetId
                  ? `${filename ?? "Your file"} is loaded. Ask me anything about your business — I have your full financial data in context.`
                  : "Upload your financial data first for business-specific insights. Or ask me general Zambian SME questions."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTIONS.map((q, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => send(q)}
                    className="text-left px-4 py-3 rounded-xl border text-sm transition-all"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--bg-card)",
                      color: "var(--text-2)",
                      fontFamily: "Inter, sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "var(--cyan)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "var(--border)";
                    }}
                  >
                    <span style={{ color: "var(--cyan)" }}>→ </span>
                    {q}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {msgs.map((m) => (
              <Bubble key={m.id} msg={m} />
            ))}
          </AnimatePresence>

          {loading && (
            <div className="flex justify-start mb-4">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center mr-2 mt-0.5 flex-shrink-0"
                style={{
                  background: "rgba(0,212,255,0.1)",
                  border: "1px solid rgba(0,212,255,0.25)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="var(--cyan)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div
                className="rounded-2xl border"
                style={{
                  background: "var(--bg-card)",
                  borderColor: "var(--border)",
                  borderRadius: "18px 18px 18px 4px",
                }}
              >
                <Dots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Error strip */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-shrink-0 mx-6 mb-2 px-4 py-2 rounded-lg text-xs"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "var(--crit)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div
        className="flex-shrink-0 px-4 pb-4 pt-2 md:px-8 border-t"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-end gap-2 rounded-2xl border p-2 transition-colors"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-page)",
            }}
            onFocus={() => {}}
          >
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask your business anything… (Enter to send)"
              disabled={loading}
              className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed py-1 px-2"
              style={{
                color: "var(--text-1)",
                fontFamily: "Inter, sans-serif",
                minHeight: "36px",
                maxHeight: "140px",
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{
                background:
                  input.trim() && !loading ? "var(--cyan)" : "var(--bg-card)",
                border: "1px solid var(--border)",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                opacity: input.trim() && !loading ? 1 : 0.4,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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
            className="text-center text-[10px] mt-1.5 opacity-40"
            style={{
              color: "var(--text-3)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            AI-BOS CFO · Groq llama-3.3-70b-versatile
            {cabinetId ? " · Business context active" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
