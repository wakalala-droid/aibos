"use client";

// components/FileUpload.tsx — AI-BOS Upload + Cabinet + Sheet Selector
// Cabinet: persists uploaded files for reuse without re-upload
// Sheet selector: switches sheets and recomputes analysis

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

const ACCEPTED = ".csv,.xlsx,.xlsm,.xls";

export default function FileUpload() {
  const {
    setUploadResult,
    setUploading,
    setUploadError,
    isUploading,
    uploadError,
    filename,
    cabinetId,
    sheets,
    activeSheet,
    isSwitchingSheet,
    cabinet,
    switchSheet,
    loadFromCabinet,
    removeFromCabinet,
    currency,
    setCurrency,
  } = useFinancialStore();

  const [dragging, setDragging] = useState(false);
  const [showCabinet, setShowCabinet] = useState(false);
  const [currencyInput, setCurrencyInput] = useState(currency);
  const fileRef = useRef<HTMLInputElement>(null);

  const doUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/proxy/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || `Upload failed (${res.status})`);
        }

        // Set currency from file metadata or keep current
        const sym = (data.currency as string) || currencyInput || "K";
        setCurrency(sym);

        setUploadResult({ ...data, filename: file.name });
      } catch (e) {
        setUploadError((e as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [setUploading, setUploadError, setUploadResult, setCurrency, currencyInput]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) doUpload(file);
    },
    [doUpload]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* ── Currency selector ── */}
      <div className="flex items-center gap-2">
        <label
          className="text-xs"
          style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
        >
          Currency symbol:
        </label>
        <input
          type="text"
          value={currencyInput}
          onChange={(e) => {
            setCurrencyInput(e.target.value);
            if (e.target.value) setCurrency(e.target.value);
          }}
          className="w-16 px-2 py-1 rounded-lg border text-sm text-center"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border)",
            color: "var(--cyan)",
            fontFamily: "JetBrains Mono, monospace",
          }}
          maxLength={3}
          title="Currency symbol (e.g. K, $, £)"
        />
        <span
          className="text-[10px]"
          style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
        >
          (default: K for Kwacha)
        </span>
      </div>

      {/* ── Drop zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className="relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
        style={{
          borderColor: dragging ? "var(--cyan)" : "var(--border)",
          background: dragging ? "var(--cyan)/5" : "var(--bg-page)",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={onFileChange}
          className="hidden"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--cyan)" }}
            />
            <p className="text-sm" style={{ color: "var(--text-2)", fontFamily: "Inter, sans-serif" }}>
              Analysing your data…
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "var(--cyan)/10", border: "1px solid var(--cyan)/30" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                  stroke="var(--cyan)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-1)", fontFamily: "Inter, sans-serif" }}>
                Drop your financial file here
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-3)", fontFamily: "Inter, sans-serif" }}>
                CSV, XLSX, XLS — Engines auto-detected
              </p>
            </div>
            <span
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-2)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              Browse files
            </span>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 py-3 rounded-xl text-sm"
            style={{
              background: "var(--crit)/10",
              border: "1px solid var(--crit)/30",
              color: "var(--crit)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {uploadError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sheet selector ── */}
      <AnimatePresence>
        {filename && sheets.length > 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border p-4"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-xs font-medium"
                style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
              >
                SHEETS IN {filename}
              </h3>
              {isSwitchingSheet && (
                <span
                  className="text-[10px]"
                  style={{ color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}
                >
                  Switching…
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {sheets.map((sheet) => (
                <button
                  key={sheet}
                  onClick={() => switchSheet(sheet)}
                  disabled={isSwitchingSheet}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: activeSheet === sheet ? "var(--cyan)" : "var(--bg-page)",
                    color: activeSheet === sheet ? "#000" : "var(--text-2)",
                    border: "1px solid",
                    borderColor: activeSheet === sheet ? "var(--cyan)" : "var(--border)",
                    fontFamily: "JetBrains Mono, monospace",
                    opacity: isSwitchingSheet ? 0.5 : 1,
                    cursor: isSwitchingSheet ? "wait" : "pointer",
                  }}
                >
                  {sheet}
                </button>
              ))}
            </div>
            {activeSheet && (
              <p
                className="text-[10px] mt-2"
                style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
              >
                Active: {activeSheet} — analysis recomputed per sheet selection
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cabinet ── */}
      {cabinet.length > 0 && (
        <div
          className="rounded-2xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <button
            onClick={() => setShowCabinet((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="18" rx="2" stroke="var(--cyan)" strokeWidth="1.5"/>
                <path d="M8 3v18M2 9h20M2 15h6" stroke="var(--cyan)" strokeWidth="1.5"/>
              </svg>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-2)", fontFamily: "JetBrains Mono, monospace" }}
              >
                FILE CABINET
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--cyan)/15", color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}
              >
                {cabinet.length}
              </span>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              style={{
                transform: showCabinet ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
                color: "var(--text-3)",
              }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          <AnimatePresence>
            {showCabinet && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div
                  className="border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  {cabinet.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-page)] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{
                            background:
                              entry.engine === "engine3"
                                ? "var(--e3, #10b981)/15"
                                : entry.engine === "engine2"
                                ? "var(--e2, #f97316)/15"
                                : "var(--cyan)/15",
                          }}
                        >
                          <span
                            className="text-[8px] font-bold"
                            style={{
                              color:
                                entry.engine === "engine3"
                                  ? "var(--e3, #10b981)"
                                  : entry.engine === "engine2"
                                  ? "var(--e2, #f97316)"
                                  : "var(--cyan)",
                              fontFamily: "JetBrains Mono, monospace",
                            }}
                          >
                            {entry.fileType.toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-xs truncate font-medium"
                            style={{ color: "var(--text-1)", fontFamily: "Inter, sans-serif" }}
                          >
                            {entry.name}
                          </p>
                          {entry.sheets.length > 1 && (
                            <p
                              className="text-[10px]"
                              style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                            >
                              {entry.sheets.length} sheets
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <button
                          onClick={() => loadFromCabinet(entry.id)}
                          className="text-[10px] px-2.5 py-1 rounded-md"
                          style={{
                            background: cabinetId === entry.id ? "var(--cyan)" : "var(--bg-page)",
                            color: cabinetId === entry.id ? "#000" : "var(--cyan)",
                            border: "1px solid var(--cyan)/30",
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {cabinetId === entry.id ? "Active" : "Load"}
                        </button>
                        <button
                          onClick={() => removeFromCabinet(entry.id)}
                          className="text-[10px] w-6 h-6 flex items-center justify-center rounded-md"
                          style={{
                            color: "var(--text-3)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className="px-4 py-2 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                  >
                    Cabinet stores up to 20 files. Persists across sessions.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
