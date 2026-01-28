import React, { useState, useEffect, useCallback } from 'react';
import { dbAll, dbRun, dbGet } from '../api/db';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Sparkles } from 'lucide-react';
import clsx from 'clsx';

const UNITS = ['KG', 'L', 'Pcs', 'Box', 'Packet', 'Dozen', 'Ltr', 'Gram', 'ML', 'Other'];
const MOVEMENT_TYPES = [
  { value: 'in', label: 'Stock In' },
  { value: 'out', label: 'Stock Out' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'wastage', label: 'Wastage' },
];

export default function Stock() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modal, setModal] = useState(null); // 'category' | 'item' | 'movement' | null
  const [editId, setEditId] = useState(null);
  const [movementItemId, setMovementItemId] = useState(null);
  const [form, setForm] = useState({ name: '', sort_order: 0 });
  const [itemForm, setItemForm] = useState({
    name: '', category_id: '', unit: 'KG', current_quantity: '', min_quantity: '', cost_per_unit: '', supplier: '',
  });
  const [movementForm, setMovementForm] = useState({ type: 'in', quantity: '', reference: '', notes: '' });
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    const res = await dbAll('SELECT * FROM stock_categories ORDER BY sort_order, name');
    setCategories(res?.data ?? []);
  }, []);

  const loadItems = useCallback(async () => {
    const res = await dbAll(
      `SELECT s.*, c.name as category_name FROM stock_items s LEFT JOIN stock_categories c ON c.id = s.category_id ORDER BY s.name`
    );
    setItems(res?.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      await loadCategories();
      await loadItems();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (categories.length && !selectedCategory) setSelectedCategory(categories[0].id);
  }, [categories]);

  const filteredItems = selectedCategory
    ? items.filter((i) => Number(i.category_id) === Number(selectedCategory))
    : items;
  const lowStockItems = items.filter((i) => Number(i.min_quantity) > 0 && Number(i.current_quantity) <= Number(i.min_quantity));

  const openCategoryModal = (cat = null) => {
    setEditId(cat?.id ?? null);
    setForm({ name: cat?.name ?? '', sort_order: cat?.sort_order ?? 0 });
    setModal('category');
  };

  const saveCategory = async () => {
    if (!form.name.trim()) return;
    if (editId) {
      await dbRun('UPDATE stock_categories SET name = ?, sort_order = ? WHERE id = ?', [form.name.trim(), form.sort_order, editId]);
    } else {
      await dbRun('INSERT INTO stock_categories (name, sort_order) VALUES (?, ?)', [form.name.trim(), form.sort_order]);
    }
    await loadCategories();
    setModal(null);
  };

  const deleteCategory = async (id) => {
    const count = (await dbGet('SELECT COUNT(*) as c FROM stock_items WHERE category_id = ?', [id])).data?.c ?? 0;
    if (count > 0) { alert('Move or delete items in this category first.'); return; }
    await dbRun('DELETE FROM stock_categories WHERE id = ?', [id]);
    await loadCategories();
    setModal(null);
  };

  const openItemModal = (item = null) => {
    setEditId(item?.id ?? null);
    setItemForm({
      name: item?.name ?? '',
      category_id: String(item?.category_id ?? selectedCategory ?? ''),
      unit: item?.unit ?? 'KG',
      current_quantity: item?.current_quantity ?? '',
      min_quantity: item?.min_quantity ?? '',
      cost_per_unit: item?.cost_per_unit ?? '',
      supplier: item?.supplier ?? '',
    });
    setModal('item');
  };

  const saveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.unit) return;
    const current = Number(itemForm.current_quantity) || 0;
    const min = Number(itemForm.min_quantity) || 0;
    const cost = Number(itemForm.cost_per_unit) || 0;
    if (editId) {
      await dbRun(
        'UPDATE stock_items SET name = ?, category_id = ?, unit = ?, current_quantity = ?, min_quantity = ?, cost_per_unit = ?, supplier = ?, updated_at = datetime("now") WHERE id = ?',
        [itemForm.name.trim(), itemForm.category_id || null, itemForm.unit, current, min, cost, itemForm.supplier?.trim() || null, editId]
      );
    } else {
      await dbRun(
        'INSERT INTO stock_items (name, category_id, unit, current_quantity, min_quantity, cost_per_unit, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [itemForm.name.trim(), itemForm.category_id || null, itemForm.unit, current, min, cost, itemForm.supplier?.trim() || null]
      );
    }
    await loadItems();
    setModal(null);
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this stock item?')) return;
    await dbRun('DELETE FROM stock_items WHERE id = ?', [id]);
    await loadItems();
    setModal(null);
  };

  const openMovementModal = (item) => {
    setMovementItemId(item.id);
    setMovementForm({ type: 'in', quantity: '', reference: '', notes: '' });
    setModal('movement');
  };

  const loadSampleData = async () => {
    if (!window.confirm('Add sample stock for a basic fast food restaurant? Existing categories/items will be kept.')) return;
    const categories = [
      { name: 'Meat', order: 1 },
      { name: 'Vegetables', order: 2 },
      { name: 'Beverages', order: 3 },
      { name: 'Packaging', order: 4 },
      { name: 'Dairy', order: 5 },
    ];
    for (const c of categories) {
      const existing = (await dbGet('SELECT id FROM stock_categories WHERE name = ?', [c.name])).data;
      if (!existing) await dbRun('INSERT INTO stock_categories (name, sort_order) VALUES (?, ?)', [c.name, c.order]);
    }
    await loadCategories();
    const allCats = (await dbAll('SELECT id, name FROM stock_categories')).data ?? [];
    const getCatId = (name) => allCats.find((c) => c.name === name)?.id;
    const items = [
      { cat: 'Meat', name: 'Chicken', unit: 'KG', qty: 50, min: 10, cost: 650 },
      { cat: 'Meat', name: 'Beef', unit: 'KG', qty: 30, min: 5, cost: 1200 },
      { cat: 'Vegetables', name: 'Potatoes', unit: 'KG', qty: 100, min: 20, cost: 80 },
      { cat: 'Vegetables', name: 'Onions', unit: 'KG', qty: 40, min: 10, cost: 60 },
      { cat: 'Vegetables', name: 'Lettuce', unit: 'KG', qty: 15, min: 5, cost: 100 },
      { cat: 'Vegetables', name: 'Tomatoes', unit: 'KG', qty: 25, min: 8, cost: 120 },
      { cat: 'Beverages', name: 'Pepsi Syrup', unit: 'L', qty: 20, min: 5, cost: 200 },
      { cat: 'Beverages', name: 'Coffee', unit: 'KG', qty: 10, min: 2, cost: 800 },
      { cat: 'Beverages', name: 'Tea', unit: 'KG', qty: 5, min: 1, cost: 500 },
      { cat: 'Packaging', name: 'Cups', unit: 'Pcs', qty: 500, min: 100, cost: 2 },
      { cat: 'Packaging', name: 'Napkins', unit: 'Packet', qty: 50, min: 10, cost: 30 },
      { cat: 'Packaging', name: 'Takeaway Box', unit: 'Pcs', qty: 200, min: 50, cost: 15 },
      { cat: 'Dairy', name: 'Cheese', unit: 'KG', qty: 20, min: 5, cost: 900 },
      { cat: 'Dairy', name: 'Butter', unit: 'KG', qty: 15, min: 3, cost: 600 },
    ];
    for (const it of items) {
      const cid = getCatId(it.cat);
      if (!cid) continue;
      const exists = (await dbGet('SELECT id FROM stock_items WHERE name = ? AND category_id = ?', [it.name, cid])).data;
      if (!exists) await dbRun('INSERT INTO stock_items (name, category_id, unit, current_quantity, min_quantity, cost_per_unit) VALUES (?, ?, ?, ?, ?, ?)', [it.name, cid, it.unit, it.qty, it.min, it.cost]);
    }
    await loadItems();
    await loadCategories();
    alert('Sample stock loaded.');
  };

  const saveMovement = async () => {
    const qty = Number(movementForm.quantity);
    if (!movementItemId || !qty || qty <= 0) return;
    const item = items.find((i) => i.id === movementItemId);
    if (!item) return;
    const current = Number(item.current_quantity) || 0;
    let newQty = current;
    if (movementForm.type === 'in' || movementForm.type === 'adjustment') {
      newQty = current + qty;
    } else {
      newQty = Math.max(0, current - qty);
    }
    await dbRun(
      'UPDATE stock_items SET current_quantity = ?, updated_at = datetime("now") WHERE id = ?',
      [newQty, movementItemId]
    );
    await dbRun(
      'INSERT INTO stock_movements (stock_item_id, type, quantity, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [movementItemId, movementForm.type, movementForm.type === 'out' || movementForm.type === 'wastage' ? -qty : qty, movementForm.reference?.trim() || null, movementForm.notes?.trim() || null, user?.id ?? null]
    );
    await loadItems();
    setModal(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse mt-4" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Stock</h1>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={loadSampleData} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200">
            <Sparkles className="w-4 h-4" /> Load sample data
          </button>
          <button type="button" onClick={() => openCategoryModal()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
            <Plus className="w-4 h-4" /> Category
          </button>
          <button type="button" onClick={() => openItemModal()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Low stock: {lowStockItems.map((i) => i.name).join(', ')}</p>
            <p className="text-sm text-amber-700">Update stock or adjust minimum level in item settings.</p>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <div className="w-52 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  'w-full text-left px-4 py-3 text-sm font-medium border-b border-slate-100 last:border-0',
                  Number(selectedCategory) === Number(cat.id) ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Item</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Quantity</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Min</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Cost/Unit</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600">Value</th>
                <th className="w-32 py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isLow = Number(item.min_quantity) > 0 && Number(item.current_quantity) <= Number(item.min_quantity);
                return (
                  <tr key={item.id} className={clsx('border-b border-slate-100 hover:bg-slate-50/50', isLow && 'bg-amber-50/50')}>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">{item.name}</span>
                      <span className="block text-xs text-slate-500">{item.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      <span>{Number(item.current_quantity).toLocaleString()}</span>
                      {isLow && <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-800">Low stock</span>}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">{Number(item.min_quantity).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-600">Rs. {Number(item.cost_per_unit).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-600">Rs. {(Number(item.current_quantity) * Number(item.cost_per_unit)).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openMovementModal(item)} className="p-1.5 rounded text-primary-600 hover:bg-primary-50" title="Stock In/Out">
                          <ArrowUpCircle className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => openItemModal(item)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => deleteItem(item.id)} className="p-1.5 rounded text-slate-500 hover:bg-red-100 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 && <div className="py-12 text-center text-slate-500">No stock items. Add items to get started.</div>}
        </div>
      </div>

      {/* Category Modal */}
      {modal === 'category' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editId ? 'Edit Category' : 'New Category'}</h2>
              <button type="button" onClick={() => setModal(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="e.g. Meat" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {editId && <button type="button" onClick={() => deleteCategory(editId)} className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium">Delete</button>}
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">Cancel</button>
              <button type="button" onClick={saveCategory} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {modal === 'item' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editId ? 'Edit Item' : 'New Stock Item'}</h2>
              <button type="button" onClick={() => setModal(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="e.g. Chicken Breast" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select value={itemForm.category_id} onChange={(e) => setItemForm((f) => ({ ...f, category_id: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
                  <select value={itemForm.unit} onChange={(e) => setItemForm((f) => ({ ...f, unit: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current Qty</label>
                  <input type="number" step="any" value={itemForm.current_quantity} onChange={(e) => setItemForm((f) => ({ ...f, current_quantity: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Qty (alert)</label>
                  <input type="number" step="any" value={itemForm.min_quantity} onChange={(e) => setItemForm((f) => ({ ...f, min_quantity: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cost per unit (Rs.)</label>
                  <input type="number" step="0.01" value={itemForm.cost_per_unit} onChange={(e) => setItemForm((f) => ({ ...f, cost_per_unit: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                <input type="text" value={itemForm.supplier} onChange={(e) => setItemForm((f) => ({ ...f, supplier: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {editId && <button type="button" onClick={() => deleteItem(editId)} className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium">Delete</button>}
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">Cancel</button>
              <button type="button" onClick={saveItem} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {modal === 'movement' && movementItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Stock In / Out</h2>
              <button type="button" onClick={() => setModal(null)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">{items.find((i) => i.id === movementItemId)?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select value={movementForm.type} onChange={(e) => setMovementForm((f) => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  {MOVEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                <input type="number" step="any" min="0.01" value={movementForm.quantity} onChange={(e) => setMovementForm((f) => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
                <input type="text" value={movementForm.reference} onChange={(e) => setMovementForm((f) => ({ ...f, reference: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="e.g. Invoice #" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input type="text" value={movementForm.notes} onChange={(e) => setMovementForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">Cancel</button>
              <button type="button" onClick={saveMovement} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
