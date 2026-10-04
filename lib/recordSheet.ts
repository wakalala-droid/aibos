// Open the Record sheet over the current page (UI/UX audit 2026-10 C3).
// The sheet itself is components/layout/RecordSheet.tsx, mounted once in the
// dashboard shell.

export const OPEN_RECORD_SHEET = 'aibos:open-record-sheet';

export function openRecordSheet(): void {
  window.dispatchEvent(new Event(OPEN_RECORD_SHEET));
}
