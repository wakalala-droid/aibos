'use client';
/**
 * AI-BOS — Inventory catalog (Evolution Initiative 3, Slice A).
 * The product master list: name, prices, opening stock, reorder level, supplier.
 * On-hand is derived from events (Slice B). Low-stock items are flagged and also
 * drive the Advisor's LowStockEngine.
 */
import { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import {
  listProducts, createProduct, updateProduct, deleteProduct,
  type Product, type ProductInput,
} from '@/lib/api';

const EMPTY: ProductInput = { name: '', category: '', unit: 'unit', buy_price: 0, sell_price: 0, opening_stock: 0, reorder_level: 0, supplier: '' };

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontSize: 'var(--fs-body)', outline: 'none',
};
const lbl: React.CSSProperties = { fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' };

export default function InventoryPage() {
  const sym = useStore(s => s.currencySymbol) || 'K';
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
    try { await deleteProduct(id); await load(); }
    catch (e) { setError((e as Error).message); }
  }

  const isLow = (p: Product) => p.reorder_level > 0 && (p.on_hand ?? p.opening_stock) <= p.reorder_level;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>Inventory</h1>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginTop: 4 }}>
          Your product catalog — prices, stock and reorder levels.
        </p>
      </div>

      <div className="grid-main">
        <SectionCard title="Products" subtitle={loading ? 'Loading…' : `${items.length} product${items.length === 1 ? '' : 's'}`}>
          {error && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-data)' }}>{error}</div>}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--fs-body)' }}>No products yet — add your first one.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Product</th><th>On hand</th><th>Buy</th><th>Sell</th><th></th></tr></thead>
                <tbody>
                  {items.map(p => (
                    <tr key={p.id}>
                      <td>
                        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{p.name}</span>
                        {p.category ? <span style={{ color: 'var(--text-4)' }}> · {p.category}</span> : null}
                        {isLow(p) && <span className="badge" style={{ marginLeft: 8, background: 'rgba(251,191,36,0.12)', color: 'var(--amber)' }}>Low</span>}
                      </td>
                      <td style={{ color: isLow(p) ? 'var(--amber)' : 'var(--text-2)' }}>{(p.on_hand ?? p.opening_stock ?? 0).toLocaleString()} {p.unit}</td>
                      <td>{fmt(p.buy_price, false, sym)}</td>
                      <td>{fmt(p.sell_price, false, sym)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => edit(p)} style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: 'var(--fs-label)', marginRight: 10 }}>Edit</button>
                        <button type="button" onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 'var(--fs-label)' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Add / edit */}
        <SectionCard title={editId ? 'Edit product' : 'Add a product'} subtitle={editId ? 'Update the details' : 'Build your catalog gradually'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} style={input} /></div>
            <div><label style={lbl}>Category</label><input value={form.category} onChange={e => set('category', e.target.value)} style={input} /></div>
            <div><label style={lbl}>Unit</label><input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="unit / kg / box" style={input} /></div>
            <div><label style={lbl}>Buy price ({sym})</label><input type="number" value={form.buy_price} onChange={e => set('buy_price', e.target.value)} style={{ ...input }} /></div>
            <div><label style={lbl}>Sell price ({sym})</label><input type="number" value={form.sell_price} onChange={e => set('sell_price', e.target.value)} style={{ ...input }} /></div>
            <div><label style={lbl}>Opening stock</label><input type="number" value={form.opening_stock} onChange={e => set('opening_stock', e.target.value)} style={{ ...input }} /></div>
            <div><label style={lbl}>Reorder level</label><input type="number" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} style={{ ...input }} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Supplier</label><input value={form.supplier} onChange={e => set('supplier', e.target.value)} style={input} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={save} disabled={saving} className="touch-target"
              style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--green)', color: '#04140d', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : editId ? 'Update' : 'Add product'}
            </button>
            {editId && <button type="button" onClick={cancel} className="touch-target" style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
