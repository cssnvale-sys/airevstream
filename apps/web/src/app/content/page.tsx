'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { content as contentApi } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Plus, Trash2 } from 'lucide-react';

const CONTENT_TYPES = ['video', 'image', 'text', 'story', 'reel', 'short'];
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-600',
  generating: 'bg-yellow-600',
  review: 'bg-blue-600',
  approved: 'bg-green-600',
  scheduled: 'bg-purple-600',
  published: 'bg-green-500',
  failed: 'bg-red-600',
};

export default function ContentPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('video');
  const [description, setDescription] = useState('');

  const loadContent = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await contentApi.list(token);
      setItems(res.data?.items ?? []);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { loadContent(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    try {
      await contentApi.create(token, { title, type, description: description || undefined });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      loadContent();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await contentApi.delete(token, id);
      loadContent();
    } catch {
      // ignore
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="text-gray-400 mt-1">Manage your content pieces</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Content
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input w-full">
                {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input w-full h-20" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No content yet. Create your first piece!</div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-600'}`}>
                  {item.status}
                </span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-gray-400">{item.type} &middot; {new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
