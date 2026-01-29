import React, { useState, useEffect, useCallback } from 'react';
import { dbAll, dbGet, dbRun } from '../api/db';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X, Wallet, TrendingUp, TrendingDown, Banknote, Calculator } from 'lucide-react';

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Supplies', 'Groceries', 'Staff', 'Maintenance', 'Other'];

const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function ExpenseBook() {
  const { user } = useAuth();
  const todayStr = toLocalDateStr(new Date());
  const [period, setPeriod] = useState('today');
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [expenses, setExpenses] = useState([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [openingCash, setOpeningCash] = useState(null); // { amount, cash_date } for period start (from)
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'expense' | 'cash' | null
  const [editExpenseId, setEditExpenseId] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    expense_date: todayStr,
    amount: '',
    category: '',
    description: '',
    notes: '',
  });
  const [cashForm, setCashForm] = useState({ cash_date: todayStr, amount: '', notes: '' });
  const [saveError, setSaveError] = useState('');

  const getDateRange = useCallback(() => {
    let from = new Date();
    let to = new Date();
    if (period === 'today') {
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      from.setMonth(from.getMonth() - 1);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
    } else {
      from = new Date(dateFrom + 'T00:00:00');
      to = new Date(dateTo + 'T23:59:59');
    }
    return { from: toLocalDateStr(from), to: toLocalDateStr(to) };
  }, [period, dateFrom, dateTo]);

  const loadData = useCallback(async () => {
    const { from, to } = getDateRange();
    setLoading(true);
    setSaveError('');
    try {
      const [salesRes, expensesRes, openingRes] = await Promise.all([
        dbGet(
          `SELECT COALESCE(SUM(CASE WHEN payment_status = 'paid' OR payment_status = 'partial' THEN total ELSE 0 END), 0) as total
           FROM orders WHERE date(created_at) >= ? AND date(created_at) <= ?`,
          [from, to]
        ),
        dbAll(
          'SELECT * FROM expenses WHERE date(expense_date) >= ? AND date(expense_date) <= ? ORDER BY expense_date DESC, id DESC',
          [from, to]
        ),
        dbGet('SELECT * FROM daily_cash WHERE cash_date = ?', [from]),
      ]);
      if (salesRes?.error) setSaveError('Could not load sales: ' + salesRes.error);
      else setSalesTotal(Number(salesRes?.data?.total) ?? 0);
      if (expensesRes?.error) {
        setSaveError('Could not load expenses: ' + expensesRes.error);
        setExpenses([]);
      } else {
        setExpenses(expensesRes?.data ?? []);
      }
      const opening = openingRes?.data;
      setOpeningCash(opening ? { amount: Number(opening.amount) || 0, cash_date: opening.cash_date } : null);
    } catch (err) {
      setSaveError(err?.message || 'Failed to load data');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openExpenseModal = (expense = null) => {
    setEditExpenseId(expense?.id ?? null);
    setExpenseForm({
      expense_date: expense ? String(expense.expense_date || '').slice(0, 10) : toLocalDateStr(new Date()),
      amount: expense != null ? String(expense.amount) : '',
      category: expense?.category ?? '',
      description: expense?.description ?? '',
      notes: expense?.notes ?? '',
    });
    setSaveError('');
    setModal('expense');
  };

  const saveExpense = async () => {
    const amount = Number(expenseForm.amount) || 0;
    if (amount <= 0 || !expenseForm.expense_date) {
      setSaveError('Enter amount and date.');
      return;
    }
    setSaveError('');
    const sql = editExpenseId
      ? 'UPDATE expenses SET expense_date = ?, amount = ?, category = ?, description = ?, notes = ? WHERE id = ?'
      : 'INSERT INTO expenses (expense_date, amount, category, description, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)';
    const params = editExpenseId
      ? [
          expenseForm.expense_date,
          amount,
          expenseForm.category?.trim() || null,
          expenseForm.description?.trim() || null,
          expenseForm.notes?.trim() || null,
          editExpenseId,
        ]
      : [
          expenseForm.expense_date,
          amount,
          expenseForm.category?.trim() || null,
          expenseForm.description?.trim() || null,
          expenseForm.notes?.trim() || null,
          user?.id ?? null,
        ];
    const res = await dbRun(sql, params);
    if (res?.error) {
      setSaveError('Could not save expense: ' + res.error);
      return;
    }
    await loadData();
    setModal(null);
  };

  const deleteExpense = async (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    await dbRun('DELETE FROM expenses WHERE id = ?', [id]);
    await loadData();
    setModal(null);
  };

  const openCashModal = (date = null) => {
    const d = date ?? getDateRange().from;
    setCashForm({
      cash_date: d,
      amount: openingCash?.cash_date === d ? String(openingCash.amount) : '',
      notes: '',
    });
    setModal('cash');
  };

  const saveOpeningCash = async () => {
    const amount = Number(cashForm.amount) || 0;
    if (!cashForm.cash_date) return;
    const res = await dbRun(
      `INSERT INTO daily_cash (cash_date, amount, notes, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(cash_date) DO UPDATE SET amount = excluded.amount, notes = COALESCE(excluded.notes, notes), updated_at = datetime('now')`,
      [cashForm.cash_date, amount, cashForm.notes?.trim() || null]
    );
    if (res?.error) {
      setSaveError('Could not save opening cash: ' + res.error);
      return;
    }
    await loadData();
    setModal(null);
  };

  const expensesTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const openingAmount = openingCash != null ? Number(openingCash.amount) || 0 : 0;
  const totalCashInHand = openingAmount + salesTotal - expensesTotal;
  const { from, to } = getDateRange();

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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-xl font-semibold text-slate-800">Expense Book</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {['today', 'week', 'month', 'custom'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                period === p ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </>
          )}
          <button
            type="button"
            onClick={() => openExpenseModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
          <button
            type="button"
            onClick={() => openCashModal(from)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500"
          >
            <Banknote className="w-4 h-4" />
            Opening Cash
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError('')} className="text-red-600 hover:text-red-800 font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Calculation: Opening + Sales − Expenses = Total cash in hand */}
      <div className="mb-6 rounded-xl border-2 border-primary-200 bg-primary-50/40 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-primary-800 font-semibold mb-4">
          <Calculator className="w-5 h-5" />
          Cash calculation (hisab)
        </div>
        <div className="flex flex-wrap items-baseline gap-2 gap-y-3 text-sm">
          <span className="text-slate-600">Opening cash in hand</span>
          <span className="font-semibold text-amber-800">
            Rs. {openingAmount.toLocaleString()}
          </span>
          <span className="text-slate-400">+</span>
          <span className="text-slate-600">Sales</span>
          <span className="font-semibold text-green-600">Rs. {salesTotal.toLocaleString()}</span>
          <span className="text-slate-400">−</span>
          <span className="text-slate-600">Expenses</span>
          <span className="font-semibold text-red-600">Rs. {expensesTotal.toLocaleString()}</span>
          <span className="text-slate-400">=</span>
          <span className="text-slate-700 font-medium">Total cash in hand</span>
          <span className="text-xl font-bold text-primary-700">Rs. {totalCashInHand.toLocaleString()}</span>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Set <strong>Opening cash</strong> for {from} (start of period) if you haven’t. Total updates automatically from sales and expenses.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Sales (period)
          </div>
          <p className="text-xl font-semibold text-green-600">Rs. {salesTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <TrendingDown className="w-4 h-4" />
            Expenses (period)
          </div>
          <p className="text-xl font-semibold text-red-600">Rs. {expensesTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-primary-200 p-4 shadow-sm bg-primary-50/30">
          <div className="flex items-center gap-2 text-primary-700 text-sm mb-1">
            <Wallet className="w-4 h-4" />
            Total cash in hand
          </div>
          <p className="text-xl font-bold text-primary-700">Rs. {totalCashInHand.toLocaleString()}</p>
        </div>
      </div>

      {/* Expenses list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Daily expenses</h2>
          <span className="text-sm text-slate-500">{expenses.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Category</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Description</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Amount</th>
                <th className="w-24 py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-slate-800">{e.expense_date}</td>
                  <td className="py-3 px-4 text-slate-700">{e.category || '—'}</td>
                  <td className="py-3 px-4 text-slate-700">{e.description || '—'}</td>
                  <td className="py-3 px-4 text-right font-medium text-red-600">Rs. {Number(e.amount).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openExpenseModal(e)}
                        className="p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteExpense(e.id)}
                        className="p-1.5 rounded text-slate-500 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expenses.length === 0 && (
          <div className="py-12 text-center text-slate-500">No expenses in this period. Add an expense to get started.</div>
        )}
      </div>

      {/* Expense modal */}
      {modal === 'expense' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">{editExpenseId ? 'Edit Expense' : 'Add Expense'}</h2>
              <button type="button" onClick={() => setModal(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, expense_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. Electricity bill"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {editExpenseId && (
                <button
                  type="button"
                  onClick={() => deleteExpense(editExpenseId)}
                  className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200"
                >
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
                Cancel
              </button>
              <button type="button" onClick={saveExpense} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opening cash modal */}
      {modal === 'cash' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Opening cash in hand</h2>
              <button type="button" onClick={() => setModal(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Set how much cash you had at the start of the period. Total cash in hand = Opening + Sales − Expenses.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={cashForm.cash_date}
                  onChange={(e) => setCashForm((f) => ({ ...f, cash_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashForm.amount}
                  onChange={(e) => setCashForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={cashForm.notes}
                  onChange={(e) => setCashForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
                Cancel
              </button>
              <button type="button" onClick={saveOpeningCash} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
