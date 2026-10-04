'use client';

// Tables become cards on phones (UI/UX audit 2026-10 A18 and B3).
//
// Below 768px every `table.data-table` (and `table.card-table`) is drawn as a
// stack of cards, one per row, each value under its column name (CSS in
// globals.css, "TABLES AS CARDS ON PHONES"). The CSS reads the column name from
// a `data-label` on each cell. DataTable writes those itself; the pages that
// build their own <table> get them here, from their header row, so no page has
// to be rewritten and a new table works without anyone remembering to label it.
//
// Because the cards are display:block, the table roles are written out
// explicitly so screen readers still hear a table with rows and columns.
// Opt a table out with class "keep-table".

import { useEffect } from 'react';

const SELECTOR = 'table.data-table:not(.keep-table), table.card-table:not(.keep-table)';

function headerLabels(table: HTMLTableElement): string[] {
  const head = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!head) return [];
  const out: string[] = [];
  for (const th of Array.from(head.cells)) {
    const text = (th.getAttribute('aria-label') || th.textContent || '').replace(/[↑↓↕]/g, '').trim();
    for (let i = 0; i < (th.colSpan || 1); i++) out.push(text);
  }
  return out;
}

function label(table: HTMLTableElement) {
  if (table.getAttribute('role') !== 'table') table.setAttribute('role', 'table');
  const labels = headerLabels(table);
  for (const group of [table.tHead, ...Array.from(table.tBodies)]) {
    if (group && !group.getAttribute('role')) group.setAttribute('role', 'rowgroup');
  }
  for (const row of Array.from(table.rows)) {
    if (!row.getAttribute('role')) row.setAttribute('role', 'row');
    let col = 0;
    for (const cell of Array.from(row.cells)) {
      const isHead = cell.tagName === 'TH';
      if (!cell.getAttribute('role')) cell.setAttribute('role', isHead && row.parentElement === table.tHead ? 'columnheader' : isHead ? 'rowheader' : 'cell');
      if (!isHead || row.parentElement !== table.tHead) {
        const want = (cell.colSpan || 1) > 1 ? '' : labels[col] ?? '';
        if (cell.getAttribute('data-label') !== want) cell.setAttribute('data-label', want);
      }
      col += cell.colSpan || 1;
    }
  }
}

export default function TableCards() {
  useEffect(() => {
    // A short timer, not requestAnimationFrame: animation frames stop in a
    // background tab, and a table that loaded there stayed unlabelled.
    let timer = 0;
    const run = () => {
      timer = 0;
      document.querySelectorAll<HTMLTableElement>(SELECTOR).forEach(label);
    };
    const schedule = () => { if (!timer) timer = window.setTimeout(run, 60); };
    run();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (timer) window.clearTimeout(timer); };
  }, []);
  return null;
}
