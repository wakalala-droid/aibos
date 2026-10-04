'use client';

// DataTable — the one table primitive for every intelligence page (audit #7).
// Sortable headers (aria-sort), optional filter chips, pagination past a page
// size, and an honest empty message. A table you can't sort is a list you have
// to read linearly; this answers "show me the worst/best X" in one click.

import { useMemo, useState } from 'react';

export interface DataTableColumn<T> {
  /** Unique column id. */
  key: string;
  label: string;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  render: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'right';
}

export interface DataTableFilter<T> {
  label: string;
  predicate: (row: T) => boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Initial sort; column must have a sortValue. */
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  /** Single-select chip row; an implicit "All" chip is added first. */
  filters?: DataTableFilter<T>[];
  /** Rows per page; pagination UI appears only past this. Default 25. */
  pageSize?: number;
  emptyMessage?: string;
  ariaLabel?: string;
}

export default function DataTable<T>({
  columns, rows, rowKey, defaultSort, filters, pageSize = 25,
  emptyMessage = 'No records yet.', ariaLabel,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(defaultSort ?? null);
  const [activeFilter, setActiveFilter] = useState<number>(-1); // -1 = All
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const f = filters && activeFilter >= 0 ? filters[activeFilter] : null;
    return f ? rows.filter(f.predicate) : rows;
  }, [rows, filters, activeFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const sv = col.sortValue;
    const out = [...filtered].sort((a, b) => {
      const av = sv(a), bv = sv(b);
      const cmp = typeof av === 'string' || typeof bv === 'string'
        ? String(av).localeCompare(String(bv))
        : Number(av) - Number(bv);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const from = sorted.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min((safePage + 1) * pageSize, sorted.length);

  const onSort = (key: string) => {
    setPage(0);
    setSort(s => (s?.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'desc' }));
  };
  const onFilter = (i: number) => { setActiveFilter(i); setPage(0); };
  // On phones the header row is hidden (rows become cards), so sorting moves
  // into one picker above the cards. Numbers read high to low, words A to Z.
  const sortable = columns.filter(c => c.sortValue);
  const numeric = (c: DataTableColumn<T>) => rows.length > 0 && typeof c.sortValue!(rows[0]) === 'number';

  return (
    <div>
      {filters && filters.length > 0 && (
        <div role="group" aria-label="Filter rows" className="chips" style={{ marginBottom: 16 }}>
          <button type="button" className="chip" aria-pressed={activeFilter === -1} onClick={() => onFilter(-1)}>
            All <span className="chip-count">{rows.length}</span>
          </button>
          {filters.map((f, i) => (
            <button key={f.label} type="button" className="chip" aria-pressed={activeFilter === i} onClick={() => onFilter(i)}>
              {f.label} <span className="chip-count">{rows.filter(f.predicate).length}</span>
            </button>
          ))}
        </div>
      )}

      {sortable.length > 0 && (
        <label className="dt-sort-mobile">
          <span>Sort by</span>
          <select
            value={sort ? `${sort.key}:${sort.dir}` : ''}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(':');
              setPage(0);
              setSort(key ? { key, dir: dir as 'asc' | 'desc' } : null);
            }}
          >
            <option value="">As listed</option>
            {sortable.flatMap(c => [
              <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.label}, {numeric(c) ? 'highest first' : 'Z to A'}</option>,
              <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.label}, {numeric(c) ? 'lowest first' : 'A to Z'}</option>,
            ])}
          </select>
        </label>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" aria-label={ariaLabel}>
          <thead>
            <tr>
              {columns.map(col => {
                const active = sort?.key === col.key;
                const sortable = !!col.sortValue;
                return (
                  <th
                    key={col.key}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    style={col.align === 'right' ? { textAlign: 'right' } : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          font: 'inherit', color: active ? 'var(--text-1)' : 'inherit',
                          letterSpacing: 'inherit', textTransform: 'inherit',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {col.label}
                        <span aria-hidden="true" style={{ opacity: active ? 1 : 0.35 }}>
                          {active ? (sort!.dir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    ) : col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map(col => (
                  <td key={col.key} data-label={col.label} style={col.align === 'right' ? { textAlign: 'right' } : undefined}>
                    {col.render(row, safePage * pageSize + i)}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ color: 'var(--text-3)', padding: '18px 12px' }}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
          <span className="tnum" style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>
            {from}–{to} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pill pill-quiet" onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0} aria-label="Previous page">
              Previous
            </button>
            <button type="button" className="pill pill-quiet" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1} aria-label="Next page">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
