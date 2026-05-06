'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useExperiments } from '@/hooks/use-experiments';
import { cn, formatNumber, formatDate } from '@/lib/utils';
import { FlaskConical, Plus, Play, Square, Trophy, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateExperimentModal } from '@/components/experiments/create-experiment-modal';

interface ExperimentRow {
  id: string;
  name: string;
  hypothesis: string | null;
  status: string;
  primaryMetric: string;
  confidenceLevel: number;
  significance: number | null;
  winnerId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  _count: { variants: number };
}

// Note: useApi<T>() wraps response as { success: boolean; data: T; meta?: { total, page, limit, pages } }
// For paginated endpoints, T is the array of items; meta holds pagination info.

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
  running: { bg: 'bg-accent-green/10', text: 'text-accent-green' },
  evaluating: { bg: 'bg-accent-purple/10', text: 'text-accent-purple' },
  completed: { bg: 'bg-accent-blue/10', text: 'text-accent-blue' },
  stopped: { bg: 'bg-accent-orange/10', text: 'text-accent-orange' },
};

export default function ExperimentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: rawData, isLoading, error: fetchError, mutate } = useExperiments<ExperimentRow[]>();

  const experiments = rawData?.data ?? [];
  const total = rawData?.meta?.total ?? 0;

  const activeCount = experiments.filter(e => e.status === 'running').length;
  const completedCount = experiments.filter(e => e.status === 'completed').length;
  const withWinnerCount = experiments.filter(e => e.winnerId).length;
  const totalVariants = experiments.reduce((sum, e) => sum + e._count.variants, 0);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Experiments</h1>
          <p className="text-text-secondary mt-1">A/B tests and multivariate experiments for content optimization.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Experiment
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Active</span>
            <Play size={18} className="text-accent-green" />
          </div>
          <p className="text-page-title text-text-primary">{activeCount}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Completed</span>
            <Square size={18} className="text-accent-blue" />
          </div>
          <p className="text-page-title text-text-primary">{completedCount}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Winners Found</span>
            <Trophy size={18} className="text-accent-orange" />
          </div>
          <p className="text-page-title text-text-primary">{withWinnerCount}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Total Variants</span>
            <BarChart3 size={18} className="text-accent-purple" />
          </div>
          <p className="text-page-title text-text-primary">{formatNumber(totalVariants)}</p>
        </div>
      </div>

      {/* Experiments table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      ) : fetchError ? (
        <div className="card text-center py-8 text-text-secondary">Failed to load experiments. Please try again later.</div>
      ) : experiments.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No experiments yet"
          description="Create your first experiment to start A/B testing content variants."
          action={{ label: 'New Experiment', onClick: () => setShowCreate(true), icon: Plus }}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-body" aria-label="Experiments list">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="text-left py-3 px-4 text-text-secondary font-medium">Name</th>
                <th scope="col" className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                <th scope="col" className="text-left py-3 px-4 text-text-secondary font-medium">Metric</th>
                <th scope="col" className="text-center py-3 px-4 text-text-secondary font-medium">Variants</th>
                <th scope="col" className="text-right py-3 px-4 text-text-secondary font-medium">Significance</th>
                <th scope="col" className="text-left py-3 px-4 text-text-secondary font-medium">Winner</th>
                <th scope="col" className="text-right py-3 px-4 text-text-secondary font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((exp) => {
                const badge = STATUS_BADGES[exp.status] ?? STATUS_BADGES.draft;
                return (
                  <tr key={exp.id} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/experiments/${exp.id}`} className="text-text-primary hover:text-accent-blue font-medium">
                        {exp.name}
                      </Link>
                      {exp.hypothesis && (
                        <p className="text-caption text-text-tertiary mt-0.5 truncate max-w-xs" title={exp.hypothesis ?? undefined}>{exp.hypothesis}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('px-2 py-0.5 rounded-full text-caption font-medium capitalize', badge.bg, badge.text)}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-secondary capitalize">{exp.primaryMetric}</td>
                    <td className="py-3 px-4 text-center text-text-secondary">{exp._count.variants}</td>
                    <td className="py-3 px-4 text-right">
                      {exp.significance != null ? (
                        <span className={cn(
                          'font-mono',
                          exp.significance <= 0.05 ? 'text-accent-green' : 'text-text-tertiary',
                        )}>
                          p={exp.significance.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-text-tertiary">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {exp.winnerId ? (
                        <Trophy size={14} className="text-accent-green inline" />
                      ) : (
                        <span className="text-text-tertiary">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-text-tertiary">
                      <time dateTime={exp.createdAt}>{formatDate(exp.createdAt)}</time>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total > 0 && (
            <div className="px-4 py-2 border-t border-border text-caption text-text-tertiary">
              {total} experiment{total !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      <CreateExperimentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); mutate(); }}
      />
    </AppLayout>
  );
}
