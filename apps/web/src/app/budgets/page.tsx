'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useApi, apiPost, apiPut, apiDelete } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Trash2, Wallet, AlertTriangle, Pause, Play } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Budget {
  id: string;
  name: string;
  budgetType: string;
  limitAmount: number;
  currentSpend: number;
  alertThreshold: number;
  category: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  percentUsed?: number;
  isOverThreshold?: boolean;
  isExceeded?: boolean;
}

type BudgetType = 'daily' | 'weekly' | 'monthly';

interface FormState {
  name: string;
  budgetType: BudgetType;
  limitAmount: string;
  alertThreshold: string;
  category: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  budgetType: 'monthly',
  limitAmount: '',
  alertThreshold: '80',
  category: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BudgetsPage() {
  const { data, isLoading, mutate } = useApi<Budget[]>('/budgets?limit=50');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);

  const budgets: Budget[] = data?.data ?? [];

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name || !form.limitAmount) {
      toast.error('Name and limit are required');
      return;
    }

    const payload = {
      name: form.name,
      budgetType: form.budgetType,
      limitAmount: Number(form.limitAmount),
      alertThreshold: Number(form.alertThreshold) / 100,
      category: form.category || null,
    };

    try {
      if (editingId) {
        await apiPut(`/budgets/${editingId}`, payload);
        toast.success('Budget updated');
      } else {
        await apiPost('/budgets', payload);
        toast.success('Budget created');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      await mutate();
    } catch {
      toast.error('Failed to save budget');
    }
  }, [form, editingId, mutate]);

  const handleEdit = useCallback((budget: Budget) => {
    setForm({
      name: budget.name,
      budgetType: budget.budgetType as BudgetType,
      limitAmount: String(budget.limitAmount),
      alertThreshold: String(Math.round(Number(budget.alertThreshold) * 100)),
      category: budget.category ?? '',
    });
    setEditingId(budget.id);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/budgets/${deleteTarget.id}`);
      toast.success('Budget deleted');
      setDeleteTarget(null);
      await mutate();
    } catch {
      toast.error('Failed to delete budget');
    }
  }, [deleteTarget, mutate]);

  const handleToggleStatus = useCallback(async (budget: Budget) => {
    const newStatus = budget.status === 'active' ? 'paused' : 'active';
    try {
      await apiPut(`/budgets/${budget.id}`, { status: newStatus });
      toast.success(`Budget ${newStatus}`);
      await mutate();
    } catch {
      toast.error('Failed to update status');
    }
  }, [mutate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-500/10';
      case 'paused': return 'text-yellow-400 bg-yellow-500/10';
      case 'exceeded': return 'text-red-400 bg-red-500/10';
      default: return 'text-text-tertiary bg-bg-tertiary';
    }
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Cost Budgets</h1>
          <p className="text-text-secondary mt-1">Manage spending limits for AI services.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(INITIAL_FORM); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> New Budget
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="text-card-title text-text-primary mb-4">
            {editingId ? 'Edit Budget' : 'New Budget'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption text-text-secondary mb-1.5">Name</label>
              <input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Monthly AI Spend"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-caption text-text-secondary mb-1.5">Period</label>
              <select
                value={form.budgetType}
                onChange={(e) => updateField('budgetType', e.target.value as BudgetType)}
                className="input w-full"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-caption text-text-secondary mb-1.5">Limit ($)</label>
              <input
                type="number"
                value={form.limitAmount}
                onChange={(e) => updateField('limitAmount', e.target.value)}
                placeholder="100.00"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-caption text-text-secondary mb-1.5">Alert at (%)</label>
              <input
                type="number"
                value={form.alertThreshold}
                onChange={(e) => updateField('alertThreshold', e.target.value)}
                placeholder="80"
                min={0}
                max={100}
                className="input w-full"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-caption text-text-secondary mb-1.5">Category (optional)</label>
              <select
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="input w-full"
              >
                <option value="">All services</option>
                <option value="ai_services">AI Services</option>
                <option value="storage">Storage</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={handleSave} className="btn-primary">
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(INITIAL_FORM); }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Budget List */}
      {isLoading ? (
        <div className="animate-pulse text-text-secondary">Loading budgets...</div>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No budgets yet"
          description="Create a budget to track and limit your AI spending."
          actionLabel="New Budget"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const percentUsed = budget.limitAmount > 0
              ? Math.min((budget.currentSpend / budget.limitAmount) * 100, 100)
              : 0;
            const overThreshold = percentUsed >= Number(budget.alertThreshold) * 100;

            return (
              <div key={budget.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-card-title text-text-primary">{budget.name}</h3>
                    <span className={cn('text-xs px-2 py-0.5 rounded capitalize', getStatusColor(budget.status))}>
                      {budget.status}
                    </span>
                    <span className="text-xs text-text-tertiary capitalize">{budget.budgetType}</span>
                    {budget.category && (
                      <span className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded">
                        {budget.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {overThreshold && (
                      <AlertTriangle size={14} className="text-yellow-400" />
                    )}
                    <button
                      onClick={() => handleToggleStatus(budget)}
                      className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors"
                      title={budget.status === 'active' ? 'Pause' : 'Resume'}
                    >
                      {budget.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => handleEdit(budget)}
                      className="text-xs text-text-secondary hover:text-text-primary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(budget)}
                      className="p-1.5 text-text-tertiary hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-secondary">
                      ${Number(budget.currentSpend).toFixed(2)} / ${Number(budget.limitAmount).toFixed(2)}
                    </span>
                    <span className={cn(
                      'font-medium',
                      percentUsed >= 100 ? 'text-red-400' : percentUsed >= 80 ? 'text-yellow-400' : 'text-text-secondary',
                    )}>
                      {percentUsed.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getUsageColor(percentUsed))}
                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-text-tertiary">
                  Period: {new Date(budget.periodStart).toLocaleDateString()} — {new Date(budget.periodEnd).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Budget"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppLayout>
  );
}
