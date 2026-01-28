import React, { useState, useEffect, useCallback } from 'react';
import { dbAll, dbGet } from '../api/db';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export default function Reports() {
  const [period, setPeriod] = useState('today'); // today | week | month | custom
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [salesSummary, setSalesSummary] = useState({ total: 0, orders: 0, cash: 0, credit: 0, cost: 0 });
  const [byCategory, setByCategory] = useState([]);
  const [byItem, setByItem] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  const getDateRange = useCallback(() => {
    const to = new Date();
    let from = new Date();
    if (period === 'today') {
      from.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      from.setMonth(from.getMonth() - 1);
      from.setHours(0, 0, 0, 0);
    } else {
      from = new Date(dateFrom);
      to.setTime(new Date(dateTo).getTime());
    }
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [period, dateFrom, dateTo]);

  const loadReports = useCallback(async () => {
    const { from, to } = getDateRange();
    setLoading(true);
    try {
      const summaryRes = await dbGet(
        `SELECT
          COALESCE(SUM(CASE WHEN payment_status = 'paid' OR payment_status = 'partial' THEN total ELSE 0 END), 0) as total,
          COUNT(*) as orders,
          COALESCE(SUM(CASE WHEN payment_method = 'cash' AND (payment_status = 'paid' OR payment_status = 'partial') THEN total ELSE 0 END), 0) as cash,
          COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN total ELSE 0 END), 0) as credit
        FROM orders WHERE date(created_at) >= ? AND date(created_at) <= ?`,
        [from, to]
      );
      const s = summaryRes?.data ?? {};
      const costRes = await dbGet(
        `SELECT COALESCE(SUM(oi.quantity * COALESCE(m.cost_price, 0)), 0) as cost
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN menu_items m ON m.id = oi.menu_item_id
         WHERE date(o.created_at) >= ? AND date(o.created_at) <= ?`,
        [from, to]
      );
      const costVal = Number(costRes?.data?.cost) || 0;
      setSalesSummary({
        total: Number(s.total) || 0,
        orders: Number(s.orders) || 0,
        cash: Number(s.cash) || 0,
        credit: Number(s.credit) || 0,
        cost: costVal,
      });

      const payBreakdown = [];
      if (Number(s.cash) > 0) payBreakdown.push({ name: 'Cash', value: Number(s.cash), color: COLORS[0] });
      if (Number(s.credit) > 0) payBreakdown.push({ name: 'Credit', value: Number(s.credit), color: COLORS[2] });
      setPaymentBreakdown(payBreakdown);

      const categoryRes = await dbAll(
        `SELECT c.name as name, COALESCE(SUM(oi.total_price), 0) as value
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN menu_items m ON m.id = oi.menu_item_id
         JOIN menu_categories c ON c.id = m.category_id
         WHERE date(o.created_at) >= ? AND date(o.created_at) <= ?
         GROUP BY c.id ORDER BY value DESC LIMIT 10`,
        [from, to]
      );
      setByCategory((categoryRes?.data ?? []).map((r) => ({ ...r, value: Number(r.value) })));

      const itemRes = await dbAll(
        `SELECT oi.item_name as name, SUM(oi.quantity) as qty, SUM(oi.total_price) as value
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE date(o.created_at) >= ? AND date(o.created_at) <= ?
         GROUP BY oi.item_name ORDER BY value DESC LIMIT 10`,
        [from, to]
      );
      setByItem(itemRes?.data ?? []);
    } catch (_) {}
    setLoading(false);
  }, [getDateRange]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-xl font-semibold text-slate-800">Reports</h1>
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
            onClick={loadReports}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 font-medium">Total Sales</p>
              <p className="text-2xl font-semibold text-slate-800 mt-1">Rs. {salesSummary.total.toLocaleString()}</p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 font-medium">Orders</p>
              <p className="text-2xl font-semibold text-slate-800 mt-1">{salesSummary.orders}</p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 font-medium">Cash</p>
              <p className="text-2xl font-semibold text-slate-800 mt-1">Rs. {salesSummary.cash.toLocaleString()}</p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 font-medium">Cost</p>
              <p className="text-2xl font-semibold text-slate-800 mt-1">Rs. {salesSummary.cost.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Sales by Category</h2>
              {byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byCategory} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `Rs.${v}`} />
                    <Tooltip formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, 'Sales']} />
                    <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-slate-500">No data for this period.</p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Payment Methods</h2>
              {paymentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name}: Rs. ${value.toLocaleString()}`}
                    >
                      {paymentBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-slate-500">No payments in this period.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <h2 className="text-sm font-semibold text-slate-700 p-4 border-b border-slate-200">Top Selling Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Item</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Qty Sold</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byItem.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-3 px-4 font-medium text-slate-800">{row.name}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{row.qty}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">Rs. {Number(row.value).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {byItem.length === 0 && <p className="py-8 text-center text-slate-500">No orders in this period.</p>}
          </div>
        </>
      )}
    </div>
  );
}
