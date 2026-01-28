import React, { useState, useEffect, useCallback } from 'react';
import { dbAll, dbRun, dbGet } from '../api/db';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import clsx from 'clsx';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'cashier', label: 'Cashier' },
];

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function Staff() {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    name: '', role: 'cashier', username: '', pin: '', phone: '', salary: '', joining_date: '', status: 'active',
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await dbAll('SELECT * FROM staff ORDER BY role, name');
    setList(res?.data ?? []);
  }, []);

  useEffect(() => {
    load().then(() => setLoading(false));
  }, [load]);

  const openModal = (staff = null) => {
    setEditId(staff?.id ?? null);
    setForm({
      name: staff?.name ?? '',
      role: staff?.role ?? 'cashier',
      username: staff?.username ?? '',
      pin: staff?.pin ?? '',
      phone: staff?.phone ?? '',
      salary: staff?.salary ?? '',
      joining_date: staff?.joining_date ? staff.joining_date.slice(0, 10) : '',
      status: staff?.status ?? 'active',
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.pin.trim()) {
      alert('Name, username and PIN are required.');
      return;
    }
    const salary = Number(form.salary) || 0;
    if (editId) {
      const res = await dbRun(
        'UPDATE staff SET name = ?, role = ?, username = ?, pin = ?, phone = ?, salary = ?, joining_date = ?, status = ? WHERE id = ?',
        [form.name.trim(), form.role, form.username.trim(), form.pin, form.phone?.trim() ?? null, salary, form.joining_date || null, form.status, editId]
      );
      if (res?.error) {
        alert(res.error);
        return;
      }
    } else {
      const existing = (await dbGet('SELECT id FROM staff WHERE username = ?', [form.username.trim()])).data;
      if (existing) {
        alert('Username already exists.');
        return;
      }
      const res = await dbRun(
        'INSERT INTO staff (name, role, username, pin, phone, salary, joining_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [form.name.trim(), form.role, form.username.trim(), form.pin, form.phone?.trim() ?? null, salary, form.joining_date || null, form.status]
      );
      if (res?.error) {
        alert(res.error);
        return;
      }
    }
    await load();
    setModal(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this staff member? They will not be able to log in.')) return;
    await dbRun('UPDATE staff SET status = ? WHERE id = ?', ['inactive', id]);
    await load();
    setModal(false);
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
        <h1 className="text-xl font-semibold text-slate-800">Staff</h1>
        <button
          type="button"
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500"
        >
          <Plus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Name</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Role</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Username</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Phone</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Salary</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="w-24 py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="py-3 px-4 font-medium text-slate-800">{s.name}</td>
                <td className="py-3 px-4 capitalize text-slate-600">{s.role}</td>
                <td className="py-3 px-4 text-slate-600">{s.username}</td>
                <td className="py-3 px-4 text-slate-600">{s.phone || '—'}</td>
                <td className="py-3 px-4 text-right text-slate-600">Rs. {Number(s.salary).toLocaleString()}</td>
                <td className="py-3 px-4 text-center">
                  <span className={clsx('px-2 py-1 rounded text-xs font-medium', s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600')}>
                    {s.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => openModal(s)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => remove(s.id)} className="p-1.5 rounded text-slate-500 hover:bg-red-100 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="py-12 text-center text-slate-500">No staff. Add staff to allow login.</div>}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">{editId ? 'Edit Staff' : 'Add Staff'}</h2>
              <button type="button" onClick={() => setModal(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
                <input type="text" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Login username" disabled={!!editId} />
                {editId && <p className="text-xs text-slate-500 mt-1">Username cannot be changed.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PIN *</label>
                <input type="password" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="4–8 digits" maxLength={8} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Salary (Rs.)</label>
                <input type="number" step="0.01" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Joining Date</label>
                <input type="date" value={form.joining_date} onChange={(e) => setForm((f) => ({ ...f, joining_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {editId && <button type="button" onClick={() => remove(editId)} className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200">Deactivate</button>}
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">Cancel</button>
              <button type="button" onClick={save} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
