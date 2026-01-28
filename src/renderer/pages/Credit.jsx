import React, { useState, useEffect, useCallback } from 'react';
import { dbAll, dbRun, dbGet } from '../api/db';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X, DollarSign } from 'lucide-react';
import clsx from 'clsx';

export default function Credit() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState(null); // 'customer' | 'payment' | null
  const [editId, setEditId] = useState(null);
  const [paymentCustomerId, setPaymentCustomerId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', credit_limit: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', notes: '' });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await dbAll(
      'SELECT * FROM credit_customers ORDER BY name'
    );
    setCustomers(res?.data ?? []);
  }, []);

  useEffect(() => {
    load().then(() => setLoading(false));
  }, [load]);

  const totalOutstanding = customers.reduce((s, c) => s + (Number(c.current_balance) || 0), 0);

  const openCustomerModal = (cust = null) => {
    setEditId(cust?.id ?? null);
    setForm({
      name: cust?.name ?? '',
      phone: cust?.phone ?? '',
      address: cust?.address ?? '',
      credit_limit: cust?.credit_limit ?? '',
    });
    setModal('customer');
  };

  const saveCustomer = async () => {
    if (!form.name.trim()) {
      alert('Name is required.');
      return;
    }
    const limit = Number(form.credit_limit) || 0;
    if (editId) {
      await dbRun(
        'UPDATE credit_customers SET name = ?, phone = ?, address = ?, credit_limit = ?, updated_at = datetime("now") WHERE id = ?',
        [form.name.trim(), form.phone?.trim() ?? null, form.address?.trim() ?? null, limit, editId]
      );
    } else {
      await dbRun(
        'INSERT INTO credit_customers (name, phone, address, credit_limit) VALUES (?, ?, ?, ?)',
        [form.name.trim(), form.phone?.trim() ?? null, form.address?.trim() ?? null, limit]
      );
    }
    await load();
    setModal(null);
  };

  const deleteCustomer = async (id) => {
    const cust = customers.find((c) => c.id === id);
    const balance = Number(cust?.current_balance) || 0;
    if (balance !== 0) {
      alert('Clear outstanding balance before removing customer.');
      return;
    }
    if (!window.confirm('Remove this credit customer?')) return;
    await dbRun('DELETE FROM credit_customers WHERE id = ?', [id]);
    await load();
    setModal(null);
  };

  const openPaymentModal = (cust) => {
    setPaymentCustomerId(cust.id);
    setPaymentForm({ amount: String(cust.current_balance || ''), payment_method: 'cash', notes: '' });
    setModal('payment');
  };

  const savePayment = async () => {
    const amount = Number(paymentForm.amount);
    if (!paymentCustomerId || !amount || amount <= 0) {
      alert('Enter a valid amount.');
      return;
    }
    const cust = customers.find((c) => c.id === paymentCustomerId);
    const current = Number(cust?.current_balance) || 0;
    if (amount > current) {
      alert('Amount cannot exceed outstanding balance.');
      return;
    }
    const newBalance = current - amount;
    await dbRun(
      'UPDATE credit_customers SET current_balance = ?, updated_at = datetime("now") WHERE id = ?',
      [newBalance, paymentCustomerId]
    );
    await dbRun(
      'INSERT INTO credit_payments (customer_id, amount, payment_method, notes, created_by) VALUES (?, ?, ?, ?, ?)',
      [paymentCustomerId, amount, paymentForm.payment_method, paymentForm.notes?.trim() ?? null, user?.id ?? null]
    );
    await load();
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
        <h1 className="text-xl font-semibold text-slate-800">Credit</h1>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700 font-medium">Total Outstanding</p>
            <p className="text-lg font-semibold text-amber-800">Rs. {totalOutstanding.toLocaleString()}</p>
          </div>
          <button
            type="button"
            onClick={() => openCustomerModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Name</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Phone</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Credit Limit</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Balance</th>
              <th className="w-32 py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const balance = Number(c.current_balance) || 0;
              const limit = Number(c.credit_limit) || 0;
              const overLimit = limit > 0 && balance > limit;
              const excessRatio = overLimit && limit > 0 ? (balance - limit) / limit : 0;
              const redBgClass = overLimit
                ? excessRatio < 0.5
                  ? 'bg-red-100'
                  : excessRatio < 1
                    ? 'bg-red-200'
                    : excessRatio < 2
                      ? 'bg-red-300'
                      : 'bg-red-400'
                : '';
              return (
                <tr key={c.id} className={clsx('border-b border-slate-100 hover:bg-slate-50/50', redBgClass)}>
                  <td className="py-3 px-4 font-medium text-slate-800">{c.name}</td>
                  <td className="py-3 px-4 text-slate-600">{c.phone || '—'}</td>
                  <td className="py-3 px-4 text-right text-slate-600">Rs. {limit.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-800">Rs. {balance.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {balance > 0 && (
                        <button
                          type="button"
                          onClick={() => openPaymentModal(c)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Pay
                        </button>
                      )}
                      <button type="button" onClick={() => openCustomerModal(c)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => deleteCustomer(c.id)} className="p-1.5 rounded text-slate-500 hover:bg-red-100 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div className="py-12 text-center text-slate-500">No credit customers. Add customers to track udhar/credit.</div>
        )}
      </div>

      {/* Customer Modal */}
      {modal === 'customer' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">{editId ? 'Edit Customer' : 'Add Credit Customer'}</h2>
              <button type="button" onClick={() => setModal(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Customer or business name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Credit Limit (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.credit_limit}
                  onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Max credit allowed (0 = no limit)"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {editId && (
                <button type="button" onClick={() => deleteCustomer(editId)} className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200">
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">
                Cancel
              </button>
              <button type="button" onClick={saveCustomer} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {modal === 'payment' && paymentCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Record Payment</h2>
              <button type="button" onClick={() => setModal(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              {customers.find((c) => c.id === paymentCustomerId)?.name} — Outstanding: Rs. {(Number(customers.find((c) => c.id === paymentCustomerId)?.current_balance) || 0).toLocaleString()}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">
                Cancel
              </button>
              <button type="button" onClick={savePayment} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
