import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Menu from './pages/Menu';
import Stock from './pages/Stock';
import Staff from './pages/Staff';
import Credit from './pages/Credit';
import Reports from './pages/Reports';
import ExpenseBook from './pages/ExpenseBook';
import Settings from './pages/Settings';

const ProtectedRoute = ({ children, section }) => {
  const { user, loading, hasAccess } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-100">
        <div className="animate-pulse text-surface-500">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (section && !hasAccess(section)) return <Navigate to="/" replace />;
  return children;
};

const IndexPage = () => {
  const { user } = useAuth();
  if (user?.role === 'cashier') return <Navigate to="/orders" replace />;
  return <Dashboard />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }
    >
      <Route index element={<ProtectedRoute><IndexPage /></ProtectedRoute>} />
      <Route path="orders" element={<ProtectedRoute section="orders"><Orders /></ProtectedRoute>} />
      <Route path="menu" element={<ProtectedRoute section="menu"><Menu /></ProtectedRoute>} />
      <Route path="stock" element={<ProtectedRoute section="stock"><Stock /></ProtectedRoute>} />
      <Route path="staff" element={<ProtectedRoute section="staff"><Staff /></ProtectedRoute>} />
      <Route path="credit" element={<ProtectedRoute section="credit"><Credit /></ProtectedRoute>} />
      <Route path="reports" element={<ProtectedRoute section="reports"><Reports /></ProtectedRoute>} />
      <Route path="expenses" element={<ProtectedRoute section="expenses"><ExpenseBook /></ProtectedRoute>} />
      <Route path="settings" element={<ProtectedRoute section="settings"><Settings /></ProtectedRoute>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
