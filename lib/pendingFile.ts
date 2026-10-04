// A file handed to AIBOS on one page and read on another (UI/UX audit
// 2026-10 C4). A receipt photo dropped or pasted anywhere waits here while the
// app opens Record, which reads it as a proposed entry; a spreadsheet waits for
// the Upload a file page. Memory only: a reload drops it, which is safe.

export type PendingKind = 'receipt' | 'sheet';

let pending: { file: File; kind: PendingKind } | null = null;

export function setPendingFile(file: File, kind: PendingKind): void {
  pending = { file, kind };
}

/** The waiting file of this kind, once; null if there is none. */
export function takePendingFile(kind: PendingKind): File | null {
  if (!pending || pending.kind !== kind) return null;
  const { file } = pending;
  pending = null;
  return file;
}
