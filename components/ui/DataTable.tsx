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

  const chipStyle = (on: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 999, cursor: 'pointer',
    fontSize: 'var(--fs-label)', fontWeight: 600,
    border: `1px solid ${on ? 'var(--cyan)' : 'var(--border-md)'}`,
    background: on ? 'var(--cyan-dim)' : 'var(--bg-badge)',
    color: on ? 'var(--cyan)' : 'var(--text-3)',
    transition: 'all 0.15s ease',
  });

  return (
    <div>
      {filters && filters.length > 0 && (
        <div role="group" aria-label="Filter rows" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <button type="button" aria-pressed={activeFilter === -1} onClick={() => onFilter(-1)} style={chipStyle(activeFilter === -1)}>
            All ({rows.length})
          </button>
          {filters.map((f, i) => (
            <button key={f.label} type="button" aria-pressed={activeFilter === i} onClick={() => onFilter(i)} style={chipStyle(activeFilter === i)}>
              {f.label} ({rows.filter(f.predicate).length})
            </button>
          ))}
        </div>
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
                  <td key={col.key} style={col.align === 'right' ? { textAlign: 'right' } : undefined}>
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
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', cursor: safePage === 0 ? 'default' : 'pointer',
                border: '1px solid var(--border-md)', background: 'var(--bg-badge)',
                color: safePage === 0 ? 'var(--text-4)' : 'var(--text-2)',
                fontSize: 'var(--fs-label)', fontWeight: 600, opacity: safePage === 0 ? 0.5 : 1,
              }}
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', cursor: safePage >= pageCount - 1 ? 'default' : 'pointer',
                border: '1px solid var(--border-md)', background: 'var(--bg-badge)',
                color: safePage >= pageCount - 1 ? 'var(--text-4)' : 'var(--text-2)',
                fontSize: 'var(--fs-label)', fontWeight: 600, opacity: safePage >= pageCount - 1 ? 0.5 : 1,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
