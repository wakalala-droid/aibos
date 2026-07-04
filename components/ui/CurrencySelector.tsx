'use client';

// CurrencySelector — the universal currency-format control. Lives in the
// dashboard header (every dashboard + admin page) and inline in the upload
// flow. It changes the DISPLAY symbol everywhere; amounts are never converted.
// Precedence rule (owned by lib/store.ts): a manual pick here wins over
// upload-detected currency until the user switches back to Auto.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { CURRENCIES, currencyForToken } from '@/lib/currency';

const geist = { fontFamily: 'Geist, sans-serif' } as const;

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M5 13l4 4L19 7" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.16s ease' }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CurrencySelector({ align = 'right' }: { align?: 'left' | 'right' }) {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const source = useStore((s) => s.currencySource);
  const detected = useStore((s) => s.detectedCurrencySymbol);
  const setCurrency = useStore((s) => s.setCurrency);

  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const active = currencyForToken(sym);
  const activeLabel = active ? `${active.name} (${active.symbol})` : `custom symbol ${sym}`;

  // Row 0 is Auto; rows 1..n are the catalog. The custom field is reached by Tab.
  const rowCount = CURRENCIES.length + 1;

  const close = useCallback((refocus = false) => {
    setOpen(false);
    setCustom('');
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Outside click + Escape — self-contained so the control works in any host.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(true); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close]);

  // Focus the checked row when the menu opens.
  useEffect(() => {
    if (!open) return;
    const manualIdx = CURRENCIES.findIndex((c) => c.symbol === sym);
    const idx = source === 'auto' || manualIdx < 0 ? 0 : manualIdx + 1;
    const t = setTimeout(() => itemRefs.current[idx]?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, source, sym]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const idx = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); itemRefs.current[(idx + 1) % rowCount]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); itemRefs.current[(idx - 1 + rowCount) % rowCount]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); itemRefs.current[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); itemRefs.current[rowCount - 1]?.focus(); }
  };

  const pick = (symbol: string, src: 'auto' | 'manual') => {
    setCurrency(symbol, src);
    close(true);
  };

  const applyCustom = () => {
    const t = custom.trim();
    if (t) pick(t, 'manual');
  };

  const rowStyle: React.CSSProperties = {
    width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent',
    cursor: 'pointer', textAlign: 'left',
  };

  const badge = (text: string, checked: boolean): React.CSSProperties => ({
    width: 40, flexShrink: 0, textAlign: 'center', padding: '4px 0', borderRadius: 6,
    background: checked ? 'var(--cyan-dim)' : 'var(--bg-badge)',
    border: `1px solid ${checked ? 'color-mix(in srgb, var(--cyan) 35%, transparent)' : 'var(--border)'}`,
    ...geist, fontSize: '0.74rem', fontWeight: 700,
    color: checked ? 'var(--cyan)' : 'var(--text-2)',
    // Long symbols (KSh, GH₵) still fit the fixed chip.
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    ...(text.length > 3 ? { fontSize: '0.62rem' } : null),
  });

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Currency format: ${activeLabel}${source === 'auto' ? ', following your uploads' : ''}. Change currency`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="dash-iconbtn"
        style={{
          height: 38, minWidth: 38, padding: '0 10px', borderRadius: 10,
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border-md)'}`,
          background: open ? 'var(--bg-badge)' : 'var(--bg-card)',
          color: 'var(--text-3)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        <span aria-hidden="true" style={{ ...geist, fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-1)' }}>{sym}</span>
        {active && (
          <span aria-hidden="true" style={{ ...geist, fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-4)' }}>
            {active.code}
          </span>
        )}
        <Chevron open={open} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="currency"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="dash-pop"
            style={{ width: 'min(320px, 92vw)', ...(align === 'left' ? { left: 0, right: 'auto' } : null) }}
          >
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ ...geist, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 2px' }}>
                Currency format
              </p>
              <p style={{ ...geist, fontSize: '0.7rem', color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>
                Changes the symbol on every page — amounts are never converted.
              </p>
            </div>

            <div role="menu" aria-label="Currency format" onKeyDown={onMenuKey} style={{ padding: 6 }}>
              {/* Auto — follow whatever the uploaded file declares */}
              <button
                ref={(el) => { itemRefs.current[0] = el; }}
                type="button"
                role="menuitemradio"
                aria-checked={source === 'auto'}
                onClick={() => pick(detected || 'K', 'auto')}
                className="dash-row"
                style={rowStyle}
              >
                <span aria-hidden="true" style={badge(detected || '·', source === 'auto')}>{detected || '·'}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', ...geist, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>
                    Auto — match my uploads
                  </span>
                  <span style={{ display: 'block', ...geist, fontSize: '0.68rem', color: 'var(--text-4)' }}>
                    {detected ? `Detected ${detected} in your last file` : 'Uses the currency found in your file'}
                  </span>
                </span>
                {source === 'auto' && <Check />}
              </button>

              <div aria-hidden="true" style={{ height: 1, background: 'var(--border)', margin: '6px 6px' }} />

              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {CURRENCIES.map((c, i) => {
                  const checked = source === 'manual' && sym === c.symbol;
                  return (
                    <button
                      key={c.code}
                      ref={(el) => { itemRefs.current[i + 1] = el; }}
                      type="button"
                      role="menuitemradio"
                      aria-checked={checked}
                      onClick={() => pick(c.symbol, 'manual')}
                      className="dash-row"
                      style={rowStyle}
                    >
                      <span aria-hidden="true" style={badge(c.symbol, checked)}>{c.symbol}</span>
                      <span style={{ minWidth: 0, flex: 1, ...geist, fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name}
                      </span>
                      <span style={{ ...geist, fontSize: '0.66rem', color: 'var(--text-4)', letterSpacing: '0.06em' }}>{c.code}</span>
                      {checked && <Check />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom symbol — full universality for currencies not in the list */}
            <form
              onSubmit={(e) => { e.preventDefault(); applyCustom(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)' }}
            >
              <label htmlFor="currency-custom-symbol" style={{ ...geist, fontSize: '0.72rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                Custom symbol
              </label>
              <input
                id="currency-custom-symbol"
                value={custom}
                maxLength={4}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="e.g. Fr"
                style={{
                  width: 64, minHeight: 34, padding: '6px 8px', textAlign: 'center',
                  borderRadius: 8, border: '1px solid var(--border-md)',
                  background: 'var(--bg-input)', color: 'var(--text-1)',
                  ...geist, fontSize: '0.82rem', outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!custom.trim()}
                style={{
                  marginLeft: 'auto', minHeight: 34, padding: '6px 14px', borderRadius: 8,
                  border: '1px solid var(--border-md)',
                  background: custom.trim() ? 'var(--cyan)' : 'var(--bg-badge)',
                  color: custom.trim() ? '#000' : 'var(--text-4)',
                  ...geist, fontSize: '0.76rem', fontWeight: 700,
                  cursor: custom.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Apply
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
