'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useWorkflows } from '@/hooks/use-api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Play, Pause, RotateCcw, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

interface WorkflowJob {
  id: string;
  jobType: string;
  status: string;
  progress: number;
  priority: number;
  retryCount: number;
  maxRetries: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, { icon: typeof Play; color: string; bg: string }> = {
  queued: { icon: Clock, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
  running: { icon: Loader2, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
  completed: { icon: CheckCircle, color: 'text-accent-green', bg: 'bg-accent-green/10' },
  failed: { icon: XCircle, color: 'text-accent-red', bg: 'bg-accent-red/10' },
  cancelled: { icon: Pause, color: 'text-text-secondary', bg: 'bg-bg-tertiary' },
};

export default function WorkflowsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: jobsRes, isLoading } = useWorkflows(
    `${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}limit=50`,
  );
  const jobs = (jobsRes?.data as unknown as WorkflowJob[]) ?? [];

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Workflows</h1>
          <div className="flex gap-2">
            {['all', 'queued', 'running', 'completed', 'failed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm capitalize transition-colors',
                  statusFilter === s
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-text-secondary" size={32} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 text-text-secondary">
            No workflow jobs found.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const style = STATUS_STYLES[job.status] ?? STATUS_STYLES.queued;
              const Icon = style.icon;
              return (
                <div key={job.id} className="card flex items-center gap-4">
                  <div className={cn('p-2 rounded-lg', style.bg)}>
                    <Icon size={18} className={cn(style.color, job.status === 'running' && 'animate-spin')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{job.jobType}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', style.bg, style.color)}>
                        {job.status}
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      ID: {job.id.slice(0, 8)}... | Priority: {job.priority} | Retries: {job.retryCount}/{job.maxRetries}
                    </div>
                    {job.error && (
                      <div className="text-xs text-accent-red mt-1 truncate">{job.error}</div>
                    )}
                  </div>
                  {job.status === 'running' && (
                    <div className="w-32">
                      <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-blue transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-text-secondary text-right mt-0.5">{job.progress}%</div>
                    </div>
                  )}
                  <div className="text-xs text-text-secondary whitespace-nowrap">
                    {formatRelativeTime(job.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
