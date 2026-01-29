import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  Package,
  Users,
  CreditCard,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', section: null },
  { to: '/orders', icon: ShoppingCart, label: 'Orders', section: 'orders' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu', section: 'menu' },
  { to: '/stock', icon: Package, label: 'Stock', section: 'stock' },
  { to: '/staff', icon: Users, label: 'Staff', section: 'staff' },
  { to: '/credit', icon: CreditCard, label: 'Credit', section: 'credit' },
  { to: '/expenses', icon: BookOpen, label: 'Expense Book', section: 'expenses' },
  { to: '/reports', icon: BarChart3, label: 'Reports', section: 'reports' },
  { to: '/settings', icon: Settings, label: 'Settings', section: 'settings' },
];

export default function Layout() {
  const { user, logout, hasAccess } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-surface-50">
      <aside className="w-56 bg-slate-800 text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-lg font-semibold tracking-tight">Hadeez POS</h1>
          <p className="text-xs text-slate-400 mt-0.5">Restaurant</p>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, section }) => {
            if (section === null && user?.role === 'cashier') return null;
            if (section && !hasAccess(section)) return null;
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  )
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2 text-xs text-slate-400">
            {user?.name} <span className="capitalize">({user?.role})</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
