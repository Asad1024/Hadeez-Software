import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Monitor, Eye, EyeOff } from 'lucide-react';

const hasElectronAPI = typeof window !== 'undefined' && window.electronAPI;

export default function Login() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !pin.trim()) {
      setError('Enter username and password');
      return;
    }
    setLoading(true);
    try {
      const user = await login(username.trim(), pin);
      if (user) navigate('/', { replace: true });
      else setError('Invalid username and PIN');
    } catch (err) {
      setError(err.message || 'Invalid username and PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-white">Hadeez Restaurant POS</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to continue</p>
        </div>

        {!hasElectronAPI && (
          <div className="mb-4 p-4 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm">
            <div className="flex items-start gap-3">
              <Monitor className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Open from the desktop app</p>
                <p className="mt-1 text-amber-200/90">
                  You are in a browser. The database only works inside the <strong>Hadeez Restaurant POS</strong> desktop app. Close this tab and start the app from the desktop shortcut or run: <code className="block mt-2 px-2 py-1 bg-slate-800 rounded text-xs">npm run electron:dev</code>
                </p>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700"
        >
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Username"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !hasElectronAPI}
            className="mt-6 w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : hasElectronAPI ? 'Sign In' : 'Open desktop app to sign in'}
          </button>
          <div className="mt-4 p-3 rounded-lg bg-slate-700/50 border border-slate-600">
            <p className="text-xs font-medium text-slate-400 mb-2">Cashier login</p>
            <p className="text-sm text-slate-300">Username: <span className="font-mono text-white">cashier</span></p>
            <p className="text-sm text-slate-300 mt-0.5">Password: <span className="font-mono text-white">1234</span></p>
            <p className="text-xs text-slate-500 mt-2">Cashier can only access Orders and Order history.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
