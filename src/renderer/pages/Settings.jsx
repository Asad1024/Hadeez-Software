import React, { useState, useEffect } from 'react';
import { dbAll, dbRun, dbGet } from '../api/db';
import { Save, FolderOpen } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [dataPath, setDataPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const keys = [
    'restaurant_name',
    'restaurant_address',
    'restaurant_phone',
    'currency',
    'tax_enabled',
    'tax_percent',
    'receipt_header',
    'receipt_footer',
  ];

  useEffect(() => {
    (async () => {
      const res = await dbAll('SELECT key, value FROM settings');
      const rows = res?.data ?? [];
      const obj = {};
      keys.forEach((k) => { obj[k] = rows.find((r) => r.key === k)?.value ?? ''; });
      setSettings(obj);
      try {
        const path = await window.electronAPI?.getDataPath?.();
        setDataPath(path || '');
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const handleChange = (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      for (const key of keys) {
        const value = settings[key] ?? '';
        await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
      }
      setMessage('Settings saved.');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage('Error: ' + (e.message || 'Failed to save'));
    }
    setSaving(false);
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
        <h1 className="text-xl font-semibold text-slate-800">Settings</h1>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Restaurant Info</h2>
          <p className="text-xs text-slate-500 mb-4">Used on receipts and reports.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Restaurant Name</label>
              <input
                type="text"
                value={settings.restaurant_name ?? ''}
                onChange={(e) => handleChange('restaurant_name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Hadeez Restaurant"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={settings.restaurant_address ?? ''}
                onChange={(e) => handleChange('restaurant_address', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={settings.restaurant_phone ?? ''}
                onChange={(e) => handleChange('restaurant_phone', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={settings.currency ?? 'Rs.'}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Rs. or $"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Tax</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tax_enabled"
                checked={settings.tax_enabled === '1'}
                onChange={(e) => handleChange('tax_enabled', e.target.checked ? '1' : '0')}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="tax_enabled" className="text-sm text-slate-700">Enable tax on orders</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tax %</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.tax_percent ?? '0'}
                onChange={(e) => handleChange('tax_percent', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Receipt</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Header Text</label>
              <input
                type="text"
                value={settings.receipt_header ?? ''}
                onChange={(e) => handleChange('receipt_header', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Thank you for dining with us!"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Footer Text</label>
              <input
                type="text"
                value={settings.receipt_footer ?? ''}
                onChange={(e) => handleChange('receipt_footer', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Please visit again"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Data Location</h2>
          <p className="text-xs text-slate-500 mb-2">Database and app data are stored here (not on C: drive root). Safe for backups.</p>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-slate-400 shrink-0" />
            <code className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded break-all">{dataPath || '—'}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
