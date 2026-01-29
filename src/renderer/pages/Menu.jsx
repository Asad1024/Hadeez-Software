import React, { useState, useEffect } from 'react';
import { dbAll, dbRun, dbGet } from '../api/db';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X, ChevronDown, Sparkles } from 'lucide-react';
import clsx from 'clsx';

export default function Menu() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'category' | 'item' | null
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', sort_order: 0 });
  const [itemForm, setItemForm] = useState({
    name: '', description: '', category_id: '', sale_price: '', cost_price: '', is_available: 1,
    variants: [], // { name, sale_price, cost_price } for sizes (cold drink: 0.5L, 1L, 1.5L; pizza: Small, Medium, Large)
  });

  const loadCategories = async () => {
    const res = await dbAll('SELECT * FROM menu_categories ORDER BY sort_order, name');
    setCategories(res?.data ?? []);
    if (!selectedCategory && (res?.data?.length)) setSelectedCategory((res.data[0]).id);
  };

  const loadItems = async () => {
    const res = await dbAll(
      'SELECT m.*, c.name as category_name FROM menu_items m LEFT JOIN menu_categories c ON c.id = m.category_id ORDER BY m.sort_order, m.name'
    );
    const itemList = res?.data ?? [];
    const variantsRes = await dbAll('SELECT * FROM item_variants ORDER BY menu_item_id, sort_order, name');
    const variantsList = variantsRes?.data ?? [];
    const variantsByItem = {};
    variantsList.forEach((v) => {
      if (!variantsByItem[v.menu_item_id]) variantsByItem[v.menu_item_id] = [];
      variantsByItem[v.menu_item_id].push(v);
    });
    setItems(itemList.map((m) => ({ ...m, variants: variantsByItem[m.id] ?? [] })));
  };

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

  const openCategoryModal = (cat = null) => {
    setEditId(cat?.id ?? null);
    setForm({ name: cat?.name ?? '', sort_order: cat?.sort_order ?? 0 });
    setModal('category');
  };

  const saveCategory = async () => {
    if (!form.name.trim()) return;
    if (editId) {
      await dbRun('UPDATE menu_categories SET name = ?, sort_order = ? WHERE id = ?', [form.name.trim(), form.sort_order, editId]);
    } else {
      await dbRun('INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)', [form.name.trim(), form.sort_order]);
    }
    await loadCategories();
    setModal(null);
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this category? Items will need a new category.')) return;
    const count = (await dbGet('SELECT COUNT(*) as c FROM menu_items WHERE category_id = ?', [id])).data?.c ?? 0;
    if (count > 0) {
      alert('Move or delete items in this category first.');
      return;
    }
    await dbRun('DELETE FROM menu_categories WHERE id = ?', [id]);
    await loadCategories();
    if (selectedCategory === id) setSelectedCategory(categories[0]?.id);
    setModal(null);
  };

  const openItemModal = (item = null) => {
    setEditId(item?.id ?? null);
    const variants = (item?.variants ?? []).map((v) => ({
      name: v.name ?? '',
      sale_price: v.sale_price ?? '',
      cost_price: v.cost_price ?? '',
    }));
    setItemForm({
      name: item?.name ?? '',
      description: item?.description ?? '',
      category_id: String(item?.category_id ?? selectedCategory ?? ''),
      sale_price: item?.sale_price ?? '',
      cost_price: item?.cost_price ?? '',
      is_available: item?.is_available ?? 1,
      variants: variants.length ? variants : [],
    });
    setModal('item');
  };

  const addVariantRow = () => {
    setItemForm((f) => ({ ...f, variants: [...(f.variants || []), { name: '', sale_price: '', cost_price: '' }] }));
  };

  const updateVariant = (index, field, value) => {
    setItemForm((f) => {
      const v = [...(f.variants || [])];
      v[index] = { ...v[index], [field]: value };
      return { ...f, variants: v };
    });
  };

  const removeVariant = (index) => {
    setItemForm((f) => ({ ...f, variants: (f.variants || []).filter((_, i) => i !== index) }));
  };

  const saveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.category_id) return;
    const hasVariants = (itemForm.variants || []).some((v) => (v.name || '').trim());
    if (!hasVariants && itemForm.sale_price === '') return;
    const sale = Number(itemForm.sale_price) || 0;
    const cost = Number(itemForm.cost_price) || 0;
    let menuItemId = editId;
    if (editId) {
      await dbRun(
        'UPDATE menu_items SET name = ?, description = ?, category_id = ?, sale_price = ?, cost_price = ?, is_available = ?, updated_at = datetime("now") WHERE id = ?',
        [itemForm.name.trim(), itemForm.description?.trim() ?? '', itemForm.category_id, sale, cost, itemForm.is_available ? 1 : 0, editId]
      );
    } else {
      const ins = await dbRun(
        'INSERT INTO menu_items (name, description, category_id, sale_price, cost_price, is_available) VALUES (?, ?, ?, ?, ?, ?)',
        [itemForm.name.trim(), itemForm.description?.trim() ?? '', itemForm.category_id, sale, cost, itemForm.is_available ? 1 : 0]
      );
      if (ins?.error) { alert('Failed to save item: ' + ins.error); return; }
      const idRes = await dbGet('SELECT id FROM menu_items ORDER BY id DESC LIMIT 1');
      menuItemId = idRes?.data?.id;
    }
    await dbRun('DELETE FROM item_variants WHERE menu_item_id = ?', [menuItemId]);
    const variantsToSave = (itemForm.variants || []).filter((v) => (v.name || '').trim() && String(v.sale_price ?? '').trim() !== '');
    for (let i = 0; i < variantsToSave.length; i++) {
      const v = variantsToSave[i];
      await dbRun(
        'INSERT INTO item_variants (menu_item_id, name, sale_price, cost_price, sort_order) VALUES (?, ?, ?, ?, ?)',
        [menuItemId, (v.name || '').trim(), Number(v.sale_price) || 0, Number(v.cost_price) || 0, i]
      );
    }
    await loadItems();
    setModal(null);
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this menu item?')) return;
    await dbRun('DELETE FROM menu_items WHERE id = ?', [id]);
    await loadItems();
    setModal(null);
  };

  const toggleAvailable = async (item) => {
    await dbRun('UPDATE menu_items SET is_available = ? WHERE id = ?', [item.is_available ? 0 : 1, item.id]);
    await loadItems();
  };

  const loadSampleData = async () => {
    if (!window.confirm('Add sample menu for a basic fast food restaurant? Existing categories/items will be kept.')) return;
    const categories = [
      { name: 'Burgers', order: 1 },
      { name: 'Fries & Sides', order: 2 },
      { name: 'Drinks', order: 3 },
      { name: 'Desserts', order: 4 },
      { name: 'Combos', order: 5 },
    ];
    for (const c of categories) {
      const existing = (await dbGet('SELECT id FROM menu_categories WHERE name = ?', [c.name])).data;
      if (!existing) await dbRun('INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)', [c.name, c.order]);
    }
    await loadCategories();
    const allCats = (await dbAll('SELECT id, name FROM menu_categories')).data ?? [];
    const getCatId = (name) => allCats.find((c) => c.name === name)?.id;
    const items = [
      { cat: 'Burgers', name: 'Chicken Burger', price: 350, cost: 180 },
      { cat: 'Burgers', name: 'Beef Burger', price: 450, cost: 220 },
      { cat: 'Burgers', name: 'Zinger Burger', price: 400, cost: 200 },
      { cat: 'Burgers', name: 'Double Burger', price: 550, cost: 280 },
      { cat: 'Burgers', name: 'Cheese Burger', price: 380, cost: 190 },
      { cat: 'Fries & Sides', name: 'French Fries', price: 150, cost: 50 },
      { cat: 'Fries & Sides', name: 'Cheese Fries', price: 200, cost: 80 },
      { cat: 'Fries & Sides', name: 'Onion Rings', price: 180, cost: 60 },
      { cat: 'Fries & Sides', name: 'Nuggets', price: 220, cost: 100 },
      { cat: 'Fries & Sides', name: 'Coleslaw', price: 120, cost: 40 },
      { cat: 'Drinks', name: 'Pepsi', price: 80, cost: 25 },
      { cat: 'Drinks', name: '7Up', price: 80, cost: 25 },
      { cat: 'Drinks', name: 'Water', price: 50, cost: 10 },
      { cat: 'Drinks', name: 'Fresh Juice', price: 120, cost: 50 },
      { cat: 'Drinks', name: 'Tea', price: 60, cost: 15 },
      { cat: 'Drinks', name: 'Coffee', price: 100, cost: 30 },
      { cat: 'Desserts', name: 'Ice Cream', price: 150, cost: 60 },
      { cat: 'Desserts', name: 'Brownie', price: 180, cost: 70 },
      { cat: 'Desserts', name: 'Milkshake', price: 200, cost: 80 },
      { cat: 'Combos', name: 'Burger Combo', price: 500, cost: 250 },
      { cat: 'Combos', name: 'Family Combo', price: 1200, cost: 600 },
    ];
    for (const it of items) {
      const cid = getCatId(it.cat);
      if (!cid) continue;
      const exists = (await dbGet('SELECT id FROM menu_items WHERE name = ? AND category_id = ?', [it.name, cid])).data;
      if (!exists) await dbRun('INSERT INTO menu_items (name, category_id, sale_price, cost_price, is_available) VALUES (?, ?, ?, ?, 1)', [it.name, cid, it.price, it.cost]);
    }
    await loadItems();
    await loadCategories();
    alert('Sample menu loaded.');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-6" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Menu</h1>
        {isAdmin && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadSampleData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200"
          >
            <Sparkles className="w-4 h-4" />
            Load sample data
          </button>
          <button
            type="button"
            onClick={() => openCategoryModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
          >
            <Plus className="w-4 h-4" />
            Category
          </button>
          <button
            type="button"
            onClick={() => openItemModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      )}
      </div>

      <div className="flex gap-4">
        <div className="w-52 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  'w-full text-left px-4 py-3 text-sm font-medium border-b border-slate-100 last:border-0 flex items-center justify-between',
                  Number(selectedCategory) === Number(cat.id) ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {cat.name}
                <ChevronDown className={clsx('w-4 h-4 shrink-0 transition-transform', Number(selectedCategory) === Number(cat.id) && 'rotate-180')} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Item</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Price</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Cost</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600">Status</th>
                  <th className="w-24 py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">{item.name}</span>
                      {item.description && <span className="block text-xs text-slate-500 mt-0.5">{item.description}</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800">
                      {(item.variants || []).length > 0
                        ? `from Rs. ${Math.min(...(item.variants || []).map((v) => Number(v.sale_price) || 0)).toLocaleString()}`
                        : `Rs. ${Number(item.sale_price).toLocaleString()}`}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">Rs. {Number(item.cost_price).toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => toggleAvailable(item)}
                          className={clsx(
                            'px-2 py-1 rounded text-xs font-medium',
                            item.is_available ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                          )}
                        >
                          {item.is_available ? 'Available' : 'Unavailable'}
                        </button>
                      ) : (
                        <span className={clsx('px-2 py-1 rounded text-xs font-medium', item.is_available ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600')}>
                          {item.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => openItemModal(item)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => deleteItem(item.id)} className="p-1.5 rounded text-slate-500 hover:bg-red-100 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredItems.length === 0 && (
            <div className="py-12 text-center text-slate-500">No items in this category. Add an item to get started.</div>
          )}
        </div>
      </div>

      {/* Category Modal */}
      {modal === 'category' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">{editId ? 'Edit Category' : 'New Category'}</h2>
              <button type="button" onClick={() => setModal(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. Burgers"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {editId && (
                <button type="button" onClick={() => deleteCategory(editId)} className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200">
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
                Cancel
              </button>
              <button type="button" onClick={saveCategory} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {modal === 'item' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">{editId ? 'Edit Item' : 'New Item'}</h2>
              <button type="button" onClick={() => setModal(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. Zinger Burger"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                <select
                  value={itemForm.category_id}
                  onChange={(e) => setItemForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={itemForm.description}
                  onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sale Price (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.sale_price}
                    onChange={(e) => setItemForm((f) => ({ ...f, sale_price: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.cost_price}
                    onChange={(e) => setItemForm((f) => ({ ...f, cost_price: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="avail"
                  checked={!!itemForm.is_available}
                  onChange={(e) => setItemForm((f) => ({ ...f, is_available: e.target.checked ? 1 : 0 }))}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="avail" className="text-sm text-slate-700">Available for sale</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sizes / Variants (optional)</label>
                <p className="text-xs text-slate-500 mb-2">For cold drinks use 0.5 L, 1 L, 1.5 L. For pizza use Small, Medium, Large. Each size can have its own price.</p>
                {(itemForm.variants || []).map((v, idx) => (
                  <div key={idx} className="flex gap-2 items-center mb-2">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                      placeholder="e.g. 1 L or Large"
                      className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={v.sale_price}
                      onChange={(e) => updateVariant(idx, 'sale_price', e.target.value)}
                      placeholder="Price"
                      className="w-24 px-2 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={v.cost_price}
                      onChange={(e) => updateVariant(idx, 'cost_price', e.target.value)}
                      placeholder="Cost"
                      className="w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button type="button" onClick={() => removeVariant(idx)} className="p-1.5 rounded text-slate-500 hover:bg-red-100 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addVariantRow} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
                  <Plus className="w-4 h-4" />
                  Add size
                </button>
                {(itemForm.variants || []).length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">If sizes are set, customer will choose size when ordering. Base price above is used when no sizes are selected.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {editId && (
                <button type="button" onClick={() => deleteItem(editId)} className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200">
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
                Cancel
              </button>
              <button type="button" onClick={saveItem} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
