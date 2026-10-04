'use client';

// FileDrop: the one way to hand AIBOS a file (UI/UX audit 2026-10 A29, B6).
//
// There were five separately built pickers (receipt on Record, Import, Stock,
// the logo on Settings and on hospitality channels), each with its own look,
// checks and messages. This is the one control, written after Origin UI's
// useFileUpload hook (MIT): tap to browse first, which is how phones work, and
// drag and drop as a desktop extra. The drop area is a real button, so Enter
// and Space open the picker. The type and size are checked here, in plain
// words, before anything is sent.
//
// variant "zone" is the large dashed area (Import). variant "button" is a
// normal button that also takes a dropped file (logo, Loyverse, receipt).

import { useId, useRef, useState } from 'react';
import { MAX_UPLOAD_BYTES, uploadTooLarge } from '@/lib/api';

export interface FileDropProps {
  onFile: (file: File) => void | Promise<void>;
  /** Same format as the input's accept: ".xlsx,.csv" or "image/png,image/jpeg". */
  accept: string;
  /** The button's words: "Choose a file", "Upload logo". */
  label: string;
  /** One line under a zone: what kinds of file and how big. */
  hint?: string;
  variant?: 'zone' | 'button';
  /** Opens the phone camera first (receipts). */
  capture?: 'environment' | 'user';
  /** Largest file in bytes. Defaults to what the web proxy carries. */
  maxBytes?: number;
  /** Photos are shrunk before sending (shrinkPhoto), so their size is checked after that. */
  photo?: boolean;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  /** Show only the icon; `label` becomes the accessible name. */
  iconOnly?: boolean;
  icon?: React.ReactNode;
  /** Report a refused file to the page instead of showing it here. */
  onError?: (message: string) => void;
  /** Look of the "button" variant (the zone is styled in globals.css). */
  style?: React.CSSProperties;
  /** Lets another button on the page open the same picker. */
  pickerRef?: React.MutableRefObject<HTMLInputElement | null>;
  /** Extra class for the "button" variant (e.g. "pill"). */
  className?: string;
}

const ext = (name: string) => (name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase();

/** Does this file match an accept string? */
export function fileMatches(file: File, accept: string): boolean {
  const tokens = accept.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const type = (file.type || '').toLowerCase();
  return tokens.some((t) =>
    t.startsWith('.') ? ext(file.name) === t
      : t.endsWith('/*') ? type.startsWith(t.slice(0, -1))
      : type === t);
}

function kindsInWords(accept: string): string {
  const a = accept.toLowerCase();
  const out: string[] = [];
  if (a.includes('image')) out.push('a photo (PNG or JPG)');
  if (a.includes('.xls')) out.push('an Excel file');
  if (a.includes('.csv') || a.includes('text/csv')) out.push('a CSV file');
  if (a.includes('pdf')) out.push('a PDF');
  return out.length ? out.join(' or ') : 'a different file';
}

export default function FileDrop({
  onFile, accept, label, hint, variant = 'zone', capture, maxBytes, photo = false,
  disabled = false, busy = false, busyLabel = 'Uploading…', iconOnly = false, icon, onError, style, pickerRef, className,
}: FileDropProps) {
  const input = useRef<HTMLInputElement | null>(null);
  const hintId = useId();
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const off = disabled || busy;

  const fail = (message: string) => {
    if (onError) onError(message);
    else setError(message);
  };

  const take = (file: File | undefined) => {
    if (input.current) input.current.value = '';   // the same file can be picked again
    if (!file || off) return;
    setError(null);
    if (!fileMatches(file, accept)) {
      fail(`${file.name} can't be used here. Use ${kindsInWords(accept)}.`);
      return;
    }
    if (!photo) {
      const limit = maxBytes ?? MAX_UPLOAD_BYTES;
      if (file.size > limit) {
        fail(maxBytes
          ? `That file is ${(file.size / 1_000_000).toFixed(1)} MB. Please use one under ${(maxBytes / 1_000_000).toFixed(0)} MB.`
          : uploadTooLarge(file) ?? 'That file is too big to send.');
        return;
      }
    }
    void onFile(file);
  };

  const dropProps = {
    onDragEnter: (e: React.DragEvent) => { if (!off && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } },
    onDragOver: (e: React.DragEvent) => { if (!off && e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); } },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); },
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.files?.length) return;
      e.preventDefault();
      e.stopPropagation();   // this control takes it, not the page-wide receipt drop
      setOver(false);
      take(e.dataTransfer.files[0]);
    },
  };

  const picker = (
    <input
      ref={(el) => { input.current = el; if (pickerRef) pickerRef.current = el; }}
      type="file"
      accept={accept}
      capture={capture}
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => take(e.target.files?.[0])}
      style={{ display: 'none' }}
    />
  );

  if (variant === 'button') {
    return (
      <>
        <button
          type="button"
          {...dropProps}
          onClick={() => input.current?.click()}
          disabled={off}
          aria-label={iconOnly ? label : undefined}
          data-over={over || undefined}
          className={`file-drop-button${className ? ` ${className}` : ''}`}
          style={style}
        >
          {icon}
          {!iconOnly && <span>{busy ? busyLabel : label}</span>}
        </button>
        {picker}
        {error && <p role="alert" className="file-drop-error">{error}</p>}
      </>
    );
  }

  return (
    <div>
      <button
        type="button"
        {...dropProps}
        onClick={() => input.current?.click()}
        disabled={off}
        aria-describedby={hint ? hintId : undefined}
        data-over={over || undefined}
        className="file-drop"
      >
        <span aria-hidden="true" className="file-drop-icon">
          {icon ?? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="file-drop-label">{busy ? busyLabel : label}</span>
        {!busy && <span className="file-drop-sub">or drop it here</span>}
      </button>
      {hint && <p id={hintId} className="file-drop-hint">{hint}</p>}
      {picker}
      {error && <p role="alert" className="file-drop-error">{error}</p>}
    </div>
  );
}
