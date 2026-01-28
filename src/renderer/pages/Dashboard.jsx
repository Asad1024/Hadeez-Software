import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dbAll, dbGet } from '../api/db';
import { ShoppingCart, CreditCard, TrendingUp, Package } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayOrders: 0,
    totalCredit: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const salesRes = await dbGet(
          "SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cnt FROM orders WHERE date(created_at) = ? AND payment_status != 'pending'",
          [today]
        );
        const creditRes = await dbGet(
          'SELECT COALESCE(SUM(current_balance), 0) as total FROM credit_customers WHERE current_balance > 0'
        );
        const lowRes = await dbGet(
          'SELECT COUNT(*) as cnt FROM stock_items WHERE min_quantity > 0 AND current_quantity <= min_quantity'
        );
        const s = salesRes?.data ?? {};
        const c = creditRes?.data ?? {};
        const l = lowRes?.data ?? {};
        setStats({
          todaySales: Number(s.total) || 0,
          todayOrders: Number(s.cnt) || 0,
          totalCredit: Number(c.total) || 0,
          lowStockCount: Number(l.cnt) || 0,
        });
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Today's Sales", value: stats.todaySales, icon: TrendingUp, to: '/reports', format: 'currency' },
    { label: "Today's Orders", value: stats.todayOrders, icon: ShoppingCart, to: '/orders', format: 'number' },
    { label: 'Outstanding Credit', value: stats.totalCredit, icon: CreditCard, to: '/credit', format: 'currency' },
    { label: 'Low Stock Items', value: stats.lowStockCount, icon: Package, to: '/stock', format: 'number' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-6">Dashboard</h1>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(({ label, value, icon: Icon, to, format }) => (
            <Link
              key={label}
              to={to}
              className="block p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary-200 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">{label}</p>
                  <p className="text-2xl font-semibold text-slate-800 mt-1">
                    {format === 'currency' ? `Rs. ${Number(value).toLocaleString()}` : value}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-8 p-5 bg-white rounded-xl border border-slate-200">
        <h2 className="text-sm font-medium text-slate-700 mb-2">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500"
          >
            <ShoppingCart className="w-4 h-4" />
            New Order
          </Link>
          <Link to="/menu" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
            View Menu
          </Link>
        </div>
      </div>
    </div>
  );
}
