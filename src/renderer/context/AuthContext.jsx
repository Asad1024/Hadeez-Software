import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbGet, dbAll } from '../api/db';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

const STORAGE_KEY = 'hadeez_pos_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback(async (username, pin) => {
    const res = await dbGet(
      'SELECT id, name, role, username, status FROM staff WHERE username = ? AND pin = ? AND status = ?',
      [username, pin, 'active']
    );
    if (res.error) throw new Error(res.error);
    const u = res.data;
    if (!u) return null;
    const userData = { id: u.id, name: u.name, role: u.role, username: u.username };
    setUser(userData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    } catch (_) {}
    return userData;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }, []);

  const hasAccess = useCallback((section) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'cashier') {
      return section === 'orders';
    }
    return false;
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const res = await dbGet(
            'SELECT id, name, role, username, status FROM staff WHERE id = ? AND status = ?',
            [saved.id, 'active']
          );
          if (!res.error && res.data) setUser(res.data);
          else setUser(null);
        }
      } catch (_) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
};
