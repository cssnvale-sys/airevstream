'use client';

import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useWorkflows, useApi, apiPost } from '@/hooks/use-api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Play, Pause, RotateCcw, CheckCircle, XCircle, Clock, Loader2, Activity, ChevronLeft, ChevronRight, RefreshCw, User } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { CopyButton } from '@/components/ui/copy-button';
import { toast } from '@/lib/toast';
import { LoadingButton } from '@/components/ui/loading-button';
import { HitlTaskCard, type HitlTask } from '@/components/workflows/hitl-task-card';

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

const STATUS_FILTERS = ['all', 'queued', 'running', 'completed', 'failed'] as const;
const JOB_TYPE_FILTERS = ['all', 'content_generation', 'image_generation', 'video_render', 'audio_generation', 'posting', 'research'] as const;
const PAGE_SIZE = 20;

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'hitl'>('jobs');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // HITL tasks
  const { data: hitlRes, isLoading: hitlLoading, mutate: hitlMutate } = useApi<HitlTask[]>('/workflows/hitl?limit=50');
  const hitlTasks = hitlRes?.data ?? [];

  // Build query params
  const queryParams = useMemo(() => {
    const parts: string[] = [`page=${page}`, `limit=${PAGE_SIZE}`];
    if (statusFilter !== 'all') parts.push(`status=${statusFilter}`);
    if (jobTypeFilter !== 'all') parts.push(`jobType=${jobTypeFilter}`);
    return parts.join('&');
  }, [statusFilter, jobTypeFilter, page]);

  const { data: jobsRes, isLoading, error: fetchError, mutate } = useWorkflows<WorkflowJob[]>(queryParams);

  const jobs = jobsRes?.data ?? [];
  const meta = jobsRes?.meta;
  const totalPages = meta?.pages ?? 1;

  const handleRetry = async (jobId: string) => {
    setRetryingId(jobId);
    try {
      await apiPost(`/system/errors/${jobId}/retry`);
      toast.success('Retry queued');
      mutate();
    } catch (err) {
      console.error('Failed to retry job:', err);
      toast.error('Failed to retry job');
    } finally {
      setRetryingId(null);
    }
  };

  // Reset page when filters change
  const updateStatusFilter = (s: string) => {
    setStatusFilter(s);
    setPage(1);
  };
  const updateJobTypeFilter = (t: string) => {
    setJobTypeFilter(t);
    setPage(1);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {fetchError && (
          <div className="mb-4 rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red flex items-center justify-between">
            <span>Failed to load workflow data.</span>
            <button onClick={() => mutate()} className="btn-secondary btn-sm ml-4">Retry</button>
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Workflows</h1>
          <div className="flex items-center gap-3">
            {activeTab === 'jobs' && (
              <>
                {/* Job type filter */}
                <select
                  value={jobTypeFilter}
                  onChange={(e) => updateJobTypeFilter(e.target.value)}
                  className="input text-caption"
                >
                  {JOB_TYPE_FILTERS.map((t) => (
                    <option key={t} value={t}>
                      {t === 'all' ? 'All Types' : t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* Refresh button */}
            <button
              onClick={() => activeTab === 'jobs' ? mutate() : hitlMutate()}
              className="btn-icon"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('jobs')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue/50 focus-visible:outline-none',
              activeTab === 'jobs' ? 'bg-accent-blue text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary',
            )}
          >
            All Jobs
          </button>
          <button
            onClick={() => setActiveTab('hitl')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-accent-blue/50 focus-visible:outline-none',
              activeTab === 'hitl' ? 'bg-accent-blue text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary',
            )}
          >
            <User size={14} />
            Human Tasks
            {hitlTasks.length > 0 && (
              <span className="min-w-[18px] h-[18px] bg-accent-red text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {hitlTasks.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'hitl' ? (
          hitlLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-text-secondary" size={32} />
            </div>
          ) : hitlTasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="No human tasks"
              description="All tasks that require human intervention will appear here."
            />
          ) : (
            <div className="space-y-3">
              {hitlTasks.map((task) => (
                <HitlTaskCard key={task.id} task={task} onComplete={() => hitlMutate()} />
              ))}
            </div>
          )
        ) : (
          <>

        {/* Status filter tabs */}
        <div className="flex gap-2 mb-6">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => updateStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm capitalize transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue/50 focus-visible:outline-none',
                statusFilter === s
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary',
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-text-secondary" size={32} />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No workflow jobs found"
            description="Workflow jobs will appear here when content is being generated or processed."
          />
        ) : (
          <>
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
                      <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                        ID: <span className="font-mono">{job.id.slice(0, 8)}...</span>
                        <CopyButton value={job.id} label="Copy job ID" size={12} showToast={false} />
                        <span className="mx-1">|</span> Priority: {job.priority} | Retries: {job.retryCount}/{job.maxRetries}
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
                    {job.status === 'failed' && (
                      <LoadingButton
                        onClick={() => handleRetry(job.id)}
                        loading={retryingId === job.id}
                        className="btn-secondary btn-sm flex items-center gap-1 shrink-0"
                      >
                        <RotateCcw size={12} />
                        Retry
                      </LoadingButton>
                    )}
                    <div className="text-xs text-text-secondary whitespace-nowrap">
                      {formatRelativeTime(job.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-text-secondary">
                  Page {page} of {totalPages} ({meta?.total ?? 0} total)
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-icon"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn-icon"
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
