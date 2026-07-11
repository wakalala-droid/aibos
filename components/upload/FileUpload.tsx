"use client";
// components/FileUpload.tsx
// Upload + Cabinet + Sheet Selector
// All new store fields accessed safely with ?? fallbacks

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialStore } from "@/lib/store";
import { logUsage, type UsageEngine } from "@/lib/usage";
import { authHeaders } from "@/lib/api";
import CurrencySelector from "@/components/ui/CurrencySelector";

const ACCEPTED = ".csv,.xlsx,.xlsm,.xls";

export default function FileUpload() {
  const store = useFinancialStore();

  // Safely access new fields — these exist in the new store
  const cabinetId = store.cabinetId ?? null;
  const sheets = store.sheets ?? [];
  const activeSheet = store.activeSheet ?? null;
  const isSwitchingSheet = store.isSwitchingSheet ?? false;
  const cabinet = store.cabinet ?? [];

  const [dragging, setDragging] = useState(false);
  const [showCabinet, setShowCabinet] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doUpload = useCallback(
    async (file: File) => {
      store.setUploading(true);
      store.setUploadError(null);

      const form = new FormData();
      form.append("file", file);

      try {
        const res = await fetch("/api/proxy/upload", {
          method: "POST",
          headers: await authHeaders(),   // backend requires a verified JWT
          body: form,
        });

        // Read the raw body FIRST so a non-JSON (HTML error page) response
        // produces a clear message instead of "Unexpected token '<'".
        const raw = await res.text();

        let data: Record<string, unknown> = {};
        try {
          data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
          // Backend returned HTML (404 / 500 / gateway error), not JSON.
          const snippet = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
          throw new Error(
            res.ok
              ? `Server returned a non-JSON response. ${snippet || ""}`.trim()
              : `Server error ${res.status}. ${snippet || "The analysis service may be offline."}`.trim()
          );
        }

        if (!res.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : `Upload failed (HTTP ${res.status})`
          );
        }

        // Currency is decided inside setUploadResult: the file's detected
        // currency applies unless the user pinned one in the universal selector.
        store.setUploadResult({ ...data, filename: file.name });
        const engine = typeof data.engine === "string" ? data.engine : undefined;
        logUsage("upload", {
          engine: ["engine1", "engine2", "engine3"].includes(engine ?? "")
            ? (engine as UsageEngine)
            : undefined,
          meta: { filename: file.name },
        });
      } catch (e) {
        store.setUploadError((e as Error).message);
      } finally {
        store.setUploading(false);
      }
    },
    [store]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
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
      {/* Currency — the same universal format selector as the dashboard header */}
      <div className="flex items-center gap-2">
        <span
          className="text-[12px]"
          style={{ color: "var(--text-3)" }}
        >
          Currency:
        </span>
        <CurrencySelector align="left" />
      </div>

      {/* Drop zone — a real button so it is keyboard-operable: Enter/Space opens
          the file picker (accessibility_system.md KEYBOARD RULE · UPLOAD RULE).
          Drag-and-drop stays as a desktop enhancement on top of tap-to-browse. */}
      <div
        role="button"
        tabIndex={store.isUploading ? -1 : 0}
        aria-label="Upload a financial, customer, or POS file. CSV, XLSX, or XLS."
        aria-busy={store.isUploading}
        aria-disabled={store.isUploading}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => { if (!store.isUploading) fileRef.current?.click(); }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !store.isUploading) {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
        style={{
          borderColor: dragging ? "var(--cyan)" : "var(--border)",
          background: dragging ? "rgba(0,212,255,0.04)" : "var(--bg-page)",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={onFileChange}
          className="hidden"
          style={{ display: "none" }}
          tabIndex={-1}
          aria-hidden="true"
        />
        {store.isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--cyan)" }}
            />
            <p
              className="text-sm"
              style={{ color: "var(--text-2)" }}
            >
              Analysing your data…
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.2)",
              }}
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
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-1)" }}
              >
                Drop your financial file here
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-3)" }}
              >
                CSV · XLSX · XLS — engine auto-detected
              </p>
            </div>
            <span
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-2)",
              }}
            >
              Browse files
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {store.uploadError && (
          <motion.div
            role="alert"
            aria-live="assertive"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 py-3 rounded-xl text-xs"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "var(--crit)",
            }}
          >
            {store.uploadError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sheet selector — only shows for multi-sheet files */}
      <AnimatePresence>
        {store.filename && sheets.length > 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border p-4"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[12px] font-medium"
                style={{
                  color: "var(--text-3)",
                }}
              >
                SHEETS — {store.filename}
              </span>
              {isSwitchingSheet && (
                <span
                  className="text-[12px]"
                  style={{ color: "var(--cyan)" }}
                >
                  Switching…
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {sheets.map((sheet) => (
                <button
                  key={sheet}
                  onClick={() => store.switchSheet(sheet)}
                  disabled={isSwitchingSheet}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background:
                      activeSheet === sheet ? "var(--cyan)" : "var(--bg-page)",
                    color: activeSheet === sheet ? "#000" : "var(--text-2)",
                    border: "1px solid",
                    borderColor:
                      activeSheet === sheet ? "var(--cyan)" : "var(--border)",
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
                className="text-[12px] mt-2"
                style={{
                  color: "var(--text-3)",
                }}
              >
                Active: {activeSheet} · each sheet re-computes independently
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabinet */}
      {cabinet.length > 0 && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={() => setShowCabinet((v) => !v)}
            aria-expanded={showCabinet}
            aria-label={`File cabinet, ${cabinet.length} files`}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect
                  x="2"
                  y="3"
                  width="20"
                  height="18"
                  rx="2"
                  stroke="var(--cyan)"
                  strokeWidth="1.5"
                />
                <path d="M8 3v18M2 9h20M2 15h6" stroke="var(--cyan)" strokeWidth="1.5" />
              </svg>
              <span
                className="text-xs font-medium"
                style={{
                  color: "var(--text-2)",
                }}
              >
                FILE CABINET
              </span>
              <span
                className="text-[12px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(0,212,255,0.12)",
                  color: "var(--cyan)",
                }}
              >
                {cabinet.length}
              </span>
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              style={{
                transform: showCabinet ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="var(--text-3)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
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
                  className="border-t divide-y"
                  style={{ borderColor: "var(--border)" }}
                >
                  {cabinet.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-[12px] font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0"
                          style={{
                            background:
                              entry.engine === "engine3"
                                ? "rgba(16,185,129,0.12)"
                                : entry.engine === "engine2"
                                ? "rgba(249,115,22,0.12)"
                                : "rgba(0,212,255,0.12)",
                            color:
                              entry.engine === "engine3"
                                ? "var(--e3, #10b981)"
                                : entry.engine === "engine2"
                                ? "var(--e2, #f97316)"
                                : "var(--cyan)",
                          }}
                        >
                          {entry.fileType.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p
                            className="text-xs truncate font-medium"
                            style={{
                              color: "var(--text-1)",
                            }}
                          >
                            {entry.name}
                          </p>
                          {entry.sheets.length > 1 && (
                            <p
                              className="text-[12px]"
                              style={{
                                color: "var(--text-3)",
                              }}
                            >
                              {entry.sheets.length} sheets
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => store.loadFromCabinet(entry.id)}
                          aria-label={cabinetId === entry.id ? `${entry.name} is active` : `Load ${entry.name}`}
                          className="text-[12px] px-2 py-1 rounded-md"
                          style={{
                            background:
                              cabinetId === entry.id
                                ? "var(--cyan)"
                                : "var(--bg-page)",
                            color:
                              cabinetId === entry.id ? "#000" : "var(--cyan)",
                            border: "1px solid rgba(0,212,255,0.3)",
                          }}
                        >
                          {cabinetId === entry.id ? "Active" : "Load"}
                        </button>
                        <button
                          type="button"
                          onClick={() => store.removeFromCabinet(entry.id)}
                          aria-label={`Remove ${entry.name} from cabinet`}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-xs"
                          style={{
                            color: "var(--text-3)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <span aria-hidden="true">×</span>
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
                    className="text-[12px]"
                    style={{
                      color: "var(--text-3)",
                    }}
                  >
                    Cabinet persists across sessions · max 20 files
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
