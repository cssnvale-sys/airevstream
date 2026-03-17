'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { accounts as accountsApi } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Plus, Trash2 } from 'lucide-react';

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'twitter', 'facebook'];
const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'bg-red-600',
  tiktok: 'bg-gray-100 text-black',
  instagram: 'bg-pink-600',
  twitter: 'bg-sky-500',
  facebook: 'bg-blue-600',
};

export default function AccountsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [platform, setPlatform] = useState('youtube');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  const loadAccounts = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await accountsApi.list(token);
      setItems(res.data?.items ?? []);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    try {
      await accountsApi.create(token, {
        platform,
        username: username || undefined,
        displayName: displayName || undefined,
      });
      setShowCreate(false);
      setUsername('');
      setDisplayName('');
      loadAccounts();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await accountsApi.delete(token, id);
      loadAccounts();
    } catch {
      // ignore
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-gray-400 mt-1">Manage your platform accounts</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Account
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input w-full">
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Display Name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input w-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Add</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No accounts connected. Add your first platform!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any) => (
            <div key={item.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[item.platform] ?? 'bg-gray-600'}`}>
                  {item.platform}
                </span>
                <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="font-medium">{item.displayName ?? item.username ?? 'Unnamed'}</p>
              {item.username && <p className="text-sm text-gray-400">@{item.username}</p>}
              <p className="text-xs text-gray-500 mt-2">Status: {item.status}</p>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
