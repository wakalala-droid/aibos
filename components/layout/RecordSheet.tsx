'use client';

// Record from anywhere (UI/UX audit 2026-10 C3, B10 bottom sheet).
//
// The Record form in a sheet over the page the owner is on: the phone bar's
// Record tab and "Record a sale" in search open it, so recording never means
// leaving what they were looking at. It is the same RecordActivity form as the
// Record page (same proposal, same offline outbox, same plan rules: the form
// itself is free on every plan). A native <dialog>, like the confirm sheet:
// focus stays inside, Escape and the backdrop close it, focus goes back to the
// button that opened it. Bottom sheet on phones, centred from 640px. The form
// is only mounted while open, so it never picks up a receipt meant for the
// Record page.

import { useEffect, useRef, useState } from 'react';
import RecordActivity from '@/components/spine/RecordActivity';
import { OPEN_RECORD_SHEET } from '@/lib/recordSheet';
import { notify } from '@/lib/toast';

export default function RecordSheet() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_RECORD_SHEET, onOpen);
    return () => window.removeEventListener(OPEN_RECORD_SHEET, onOpen);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="record-sheet"
      aria-labelledby="record-sheet-title"
      onCancel={(e) => { e.preventDefault(); setOpen(false); }}
      onClose={() => setOpen(false)}
      onClick={(e) => { if (e.target === ref.current) setOpen(false); }}
    >
      {open && (
        <div className="record-sheet-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h2 id="record-sheet-title" style={{ margin: 0, fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)' }}>
              Record
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-1)', fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <RecordActivity onSaved={() => { notify('Recorded. Your books are updated.'); setOpen(false); }} />
        </div>
      )}
    </dialog>
  );
}
