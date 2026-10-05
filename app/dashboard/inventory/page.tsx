'use client';
/**
 * AIBOS — Inventory catalog (Evolution Initiative 3, Slice A).
 * The product master list: name, prices, opening stock, reorder level, supplier.
 * On-hand is derived from events (Slice B). Low-stock items are flagged and also
 * drive the Advisor's LowStockEngine.
 */
import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Package, Pencil, Trash2 } from 'lucide-react';
import FileDrop from '@/components/ui/FileDrop';
import Stat from '@/components/ui/Stat';
import { undoable } from '@/lib/toast';
import SectionCard from '@/components/ui/SectionCard';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { industryOf, starterProductsFor } from '@/lib/industries';
import PageHeader from '@/components/ui/PageHeader';
import {
  listProducts, createProduct, updateProduct, deleteProduct, importLoyverseItems, stockTake,
  type Product, type ProductInput,
} from '@/lib/api';

const EMPTY: ProductInput = { name: '', category: '', unit: 'unit', buy_price: 0, sell_price: 0, opening_stock: 0, reorder_level: 0, supplier: '' };


export default function InventoryPage() {
  const sym = useStore(s => s.currencySymbol) || 'K';
  const { profile } = useProfile();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listProducts()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof ProductInput, v: string) =>
    setForm(p => ({ ...p, [k]: ['buy_price', 'sell_price', 'opening_stock', 'reorder_level'].includes(k) ? Number(v) : v }));

  function edit(p: Product) {
    setEditId(p.id);
    setForm({ name: p.name, category: p.category ?? '', unit: p.unit, buy_price: p.buy_price, sell_price: p.sell_price, opening_stock: p.opening_stock, reorder_level: p.reorder_level, supplier: p.supplier ?? '' });
  }
  function cancel() { setEditId(null); setForm(EMPTY); }

  async function save() {
    if (!form.name?.trim()) { setError('Product name is required.'); return; }
    setSaving(true); setError(null);
    try {
      if (editId) await updateProduct(editId, form);
      else await createProduct(form);
      cancel(); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    const name = items.find(p => p.id === id)?.name || "this product";
    setItems((xs) => xs.filter((p) => p.id !== id));
    undoable({
      message: `${name} removed. Sales already recorded stay in your books.`,
      run: () => deleteProduct(id),
      onUndo: () => { void load(); },
      onDone: () => { void load(); },
      onError: (e) => { setError(e.message); void load(); },
    });
  }

  // Industry starter products (audit #51) — one tap seeds a template catalog.
  const ind = industryOf(profile?.business_type, profile?.industry);
  const starters = starterProductsFor(profile?.business_type, profile?.industry);
  const [seeding, setSeeding] = useState(false);
  async function seedStarters() {
    setSeeding(true); setError(null);
    try {
      for (const s of starters) {
        await createProduct({ name: s.name, category: s.category, unit: s.unit, buy_price: 0, sell_price: 0, opening_stock: 0, reorder_level: 0, supplier: '' });
      }
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSeeding(false); }
  }

  // Stock-take (audit #49).
  const [takeMode, setTakeMode] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [takeBusy, setTakeBusy] = useState(false);
  const [takeMsg, setTakeMsg] = useState<string | null>(null);
  async function submitStockTake() {
    setTakeBusy(true); setError(null);
    try {
      const payload = Object.entries(counts)
        .filter(([, v]) => v !== '' && !isNaN(Number(v)))
        .map(([name, v]) => ({ name, counted: Number(v) }));
      const out = await stockTake(payload);
      setTakeMsg(`${out.adjusted} product${out.adjusted === 1 ? '' : 's'} adjusted${out.adjusted === 0 ? ': everything matched' : ''}.`);
      setCounts({});
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setTakeBusy(false); }
  }

  // Loyverse catalog import (audit #29) — idempotent, existing names skipped.
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  async function importLoyverse(file: File) {
    setImporting(true); setError(null); setImportMsg(null);
    try {
      const out = await importLoyverseItems(file);
      setImportMsg(
        `${out.created_count} product${out.created_count === 1 ? '' : 's'} imported`
        + (out.store ? ` from ${out.store}` : '')
        + (out.skipped_existing ? ` · ${out.skipped_existing} already here` : '')
        + (out.warnings.length ? ` · ${out.warnings.length} row(s) skipped` : ''));
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setImporting(false); }
  }

  const isLow = (p: Product) => p.reorder_level > 0 && (p.on_hand ?? p.opening_stock) <= p.reorder_level;
  const low = items.filter(isLow);
  const stockValue = items.reduce((a, p) => a + Math.max(0, p.on_hand ?? p.opening_stock ?? 0) * (p.buy_price || 0), 0);

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Your products: prices, how many you have and when to reorder."
        actions={
          <>
            {items.length > 0 && (
              <button type="button" className="pill" aria-pressed={takeMode}
                onClick={() => { setTakeMode(v => !v); setCounts({}); setTakeMsg(null); }}>
                <ClipboardCheck aria-hidden="true" />{takeMode ? 'Stop counting' : 'Count stock'}
              </button>
            )}
            <FileDrop
              variant="button" accept=".csv,text/csv" label="Import from Loyverse" className="pill"
              busy={importing} busyLabel="Importing…"
              onFile={(f) => void importLoyverse(f)} onError={setError}
            />
          </>
        }
      />
      {importMsg && <p role="status" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: '0 0 16px' }}>{importMsg}</p>}

      <div className="home-trio" style={{ marginBottom: 16 }}>
        <Stat label="Products" count={items.length} loading={loading}
          sub={items.length === 0 ? 'Add your first one below' : 'in your catalogue'} />
        <Stat label="Running low" count={low.length} loading={loading} valueTone={low.length ? 'warn' : undefined}
          tone={low.length ? 'warn' : undefined}
          sub={low.length === 0 ? 'Nothing below its reorder level'
            : `${low.slice(0, 2).map((x) => x.name).join(', ')}${low.length > 2 ? ` and ${low.length - 2} more` : ''}`} />
        <Stat label="Worth at cost" money={stockValue} sym={sym} loading={loading}
          sub="What is on the shelf, at the price you paid" />
      </div>

      {takeMode && (
        <SectionCard title="Count your stock" subtitle="Count what is on the shelf. AIBOS changes only the ones that differ." style={{ marginBottom: 16 }}>
          {takeMsg && <p role="status" style={{ fontSize: 'var(--fs-body)', color: 'var(--good)', margin: '0 0 12px' }}>{takeMsg}</p>}
          <div>
            {items.map(p => {
              const onHand = p.on_hand ?? p.opening_stock;
              return (
                <div key={p.id} className="row">
                  <span className="avatar" aria-hidden="true"><Package /></span>
                  <span className="row-main">
                    <span className="row-title">{p.name}</span>
                    <span className="row-sub">AIBOS has {onHand.toLocaleString()} {p.unit}</span>
                  </span>
                  <input type="number" inputMode="decimal" aria-label={`Counted ${p.name}`} placeholder="Count"
                    value={counts[p.name] ?? ''} onChange={e => setCounts(c => ({ ...c, [p.name]: e.target.value }))}
                    className="field" style={{ width: 120, flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
          <button type="button" className="pill pill-primary" disabled={takeBusy || Object.keys(counts).length === 0}
            onClick={() => void submitStockTake()} style={{ marginTop: 16 }}>
            {takeBusy ? 'Saving…' : 'Save count'}
          </button>
        </SectionCard>
      )}

      <div className="grid-main">
        <SectionCard title="Products">
          {error && <div role="alert" style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--red-dim)', color: 'var(--red)', fontSize: 'var(--fs-body)' }}>{error}</div>}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-body)', margin: '0 0 14px' }}>No products yet: add your first one, or start from a template for your {ind.label}.</p>
              <button type="button" className="pill" disabled={seeding}
                onClick={() => void seedStarters()}>
                {seeding ? 'Adding…' : `Add ${starters.length} starter products`}
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Product</th><th>On hand</th><th style={{ textAlign: 'right' }}>Buy</th><th style={{ textAlign: 'right' }}>Sell</th><th><span className="sr-only">Change</span></th></tr></thead>
                <tbody>
                  {items.map(p => (
                    <tr key={p.id}>
                      <td data-label="Product">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                          <span className={`avatar${isLow(p) ? ' avatar-warn' : ''}`} aria-hidden="true"><Package /></span>
                          <span style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{p.name}</span>
                            {p.category ? <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-label)' }}>{p.category}</span> : null}
                          </span>
                        </span>
                      </td>
                      <td data-label="On hand">
                        <span style={{ color: isLow(p) ? 'var(--amber)' : 'var(--text-2)', fontWeight: isLow(p) ? 600 : undefined }}>
                          {(p.on_hand ?? p.opening_stock ?? 0).toLocaleString()} {p.unit}
                        </span>
                        {isLow(p) && <span className="badge" style={{ marginLeft: 8, background: 'var(--amber-dim)', color: 'var(--amber)' }}>Low</span>}
                      </td>
                      <td data-label="Buy" style={{ textAlign: 'right' }}>{fmt(p.buy_price, false, sym)}</td>
                      <td data-label="Sell" style={{ textAlign: 'right', color: 'var(--text-1)', fontWeight: 600 }}>{fmt(p.sell_price, false, sym)}</td>
                      <td data-label="" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <span className="row-actions">
                          <button type="button" className="icon-pill" onClick={() => edit(p)} aria-label={`Change ${p.name}`}><Pencil aria-hidden="true" /></button>
                          <button type="button" className="icon-pill danger" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}><Trash2 aria-hidden="true" /></button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Add / edit */}
        <SectionCard title={editId ? 'Change a product' : 'Add a product'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}><label htmlFor="p-name" className="field-label">Name</label><input id="p-name" required value={form.name} onChange={e => set('name', e.target.value)} className="field" /></div>
            <div><label htmlFor="p-cat" className="field-label">Category</label><input id="p-cat" value={form.category} onChange={e => set('category', e.target.value)} className="field" /></div>
            <div><label htmlFor="p-unit" className="field-label">Unit</label><input id="p-unit" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="unit, kg, box" className="field" /></div>
            <div><label htmlFor="p-buy" className="field-label">Buy price ({sym})</label><input id="p-buy" type="number" inputMode="decimal" value={form.buy_price} onChange={e => set('buy_price', e.target.value)} className="field" /></div>
            <div><label htmlFor="p-sell" className="field-label">Sell price ({sym})</label><input id="p-sell" type="number" inputMode="decimal" value={form.sell_price} onChange={e => set('sell_price', e.target.value)} className="field" /></div>
            <div><label htmlFor="p-open" className="field-label">Opening stock</label><input id="p-open" type="number" inputMode="decimal" value={form.opening_stock} onChange={e => set('opening_stock', e.target.value)} className="field" /></div>
            <div><label htmlFor="p-reorder" className="field-label">Reorder at</label><input id="p-reorder" type="number" inputMode="decimal" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} className="field" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label htmlFor="p-supplier" className="field-label">Supplier</label><input id="p-supplier" value={form.supplier} onChange={e => set('supplier', e.target.value)} className="field" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={save} disabled={saving} className="pill pill-primary">
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Add product'}
            </button>
            {editId && <button type="button" onClick={cancel} className="pill pill-quiet">Cancel</button>}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
