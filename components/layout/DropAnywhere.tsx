'use client';

// Drop or paste a receipt anywhere (UI/UX audit 2026-10 C4).
//
// Drag a receipt photo onto any page, or paste one, and AIBOS opens Record and
// reads it as a proposed entry, exactly as the camera button there does. A
// spreadsheet opens Upload a file with it already chosen. A FileDrop on the
// page takes a file dropped on it first (it stops the event), so this only
// catches drops that land anywhere else. Only for people whose role can use
// the page the file goes to.

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useProfile } from '@/lib/profile';
import { roleAllows } from '@/lib/nav';
import { setPendingFile, type PendingKind } from '@/lib/pendingFile';
import { notify } from '@/lib/toast';

const SHEET = /\.(xlsx|xls|csv)$/i;

function kindOf(file: File): PendingKind | null {
  if (file.type.startsWith('image/')) return 'receipt';
  if (SHEET.test(file.name)) return 'sheet';
  return null;
}

export default function DropAnywhere() {
  const router = useRouter();
  const pathname = usePathname();
  const { teamRole } = useProfile();
  const [showing, setShowing] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const canReceipt = roleAllows(teamRole, '/dashboard/record');
    const canSheet = roleAllows(teamRole, '/dashboard/import');
    if (!canReceipt && !canSheet) return;

    const hand = (file: File) => {
      const kind = kindOf(file);
      if (kind === 'receipt' && canReceipt) {
        setPendingFile(file, 'receipt');
        if (pathname === '/dashboard/record') window.dispatchEvent(new Event('aibos:pending-file'));
        else router.push('/dashboard/record?receipt=1');
      } else if (kind === 'sheet' && canSheet) {
        setPendingFile(file, 'sheet');
        if (pathname === '/dashboard/import') window.dispatchEvent(new Event('aibos:pending-file'));
        else router.push('/dashboard/import');
      } else {
        notify(`${file.name} can't be read here. Drop a receipt photo or a spreadsheet.`, 'error');
      }
    };

    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));
    const onEnter = (e: DragEvent) => { if (hasFiles(e)) { depth.current += 1; setShowing(true); } };
    const onLeave = (e: DragEvent) => { if (hasFiles(e)) { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setShowing(false); } };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    // Capture phase: the overlay goes away even when a FileDrop takes the file
    // and stops the event before it bubbles up to the handler below.
    const onDropCapture = () => { depth.current = 0; setShowing(false); };
    const onDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      e.preventDefault();   // never let the browser open the file in place of the app
      hand(file);
    };
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? [])[0];
      if (!file || !file.type.startsWith('image/')) return;   // text pastes are untouched
      e.preventDefault();
      hand(file);
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDropCapture, true);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDropCapture, true);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, [pathname, router, teamRole]);

  if (!showing) return null;
  return (
    // Visual only: pointer events pass through so a FileDrop under it still
    // takes a file dropped straight onto it.
    <div className="drop-anywhere" aria-hidden="true">
      <p>Drop a receipt photo to record it, or a spreadsheet to upload it</p>
    </div>
  );
}
