'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { workflows as workflowsApi } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Plus, Play, Trash2 } from 'lucide-react';

export default function WorkflowsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadWorkflows = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await workflowsApi.list(token);
      setItems(res.data?.items ?? []);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { loadWorkflows(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    try {
      await workflowsApi.create(token, {
        name,
        description: description || undefined,
        definition: {
          id: `wf-${Date.now()}`,
          name,
          steps: [
            { id: 'step-1', type: 'research', name: 'Research Topics', config: {} },
            { id: 'step-2', type: 'script', name: 'Generate Script', config: {}, dependsOn: ['step-1'] },
            { id: 'step-3', type: 'review', name: 'Review Content', config: {}, dependsOn: ['step-2'] },
          ],
        },
      });
      setShowCreate(false);
      setName('');
      setDescription('');
      loadWorkflows();
    } catch {
      // ignore
    }
  };

  const handleRun = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await workflowsApi.run(token, id);
      loadWorkflows();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await workflowsApi.delete(token, id);
      loadWorkflows();
    } catch {
      // ignore
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-gray-400 mt-1">Automate your content pipeline</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Workflow
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Workflow Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input w-full h-20" />
          </div>
          <p className="text-xs text-gray-500">A default 3-step workflow (Research → Script → Review) will be created. You can customize it later.</p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No workflows yet. Create your first automation!</div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-400">
                  {item.description ?? 'No description'} &middot; {item._count?.runs ?? 0} runs
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleRun(item.id)} className="btn-primary flex items-center gap-1 text-sm py-1.5 px-3">
                  <Play size={14} /> Run
                </button>
                <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-400 transition-colors p-2">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
