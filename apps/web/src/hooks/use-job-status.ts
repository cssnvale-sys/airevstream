'use client';

// Note: Currently unused — the create page uses per-shot local state tracking
// instead of job polling. This hook is available for future features that need
// to poll a single BullMQ job status (e.g. video rendering progress).

import { useApi } from './use-api';

interface JobStatus {
  id: string;
  jobType: string;
  status: string;
  progress: number;
  result: unknown;
  failedReason: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

/**
 * Poll a job's status every `intervalMs` until it reaches a terminal state.
 */
export function useJobStatus(jobId: string | null, intervalMs = 2000) {
  const { data, error, isLoading } = useApi<JobStatus>(
    jobId ? `/jobs/${jobId}` : null,
    {
      refreshInterval: (latestData) => {
        const job = (latestData as { data?: JobStatus } | undefined)?.data;
        if (job && TERMINAL_STATUSES.includes(job.status)) return 0;
        return intervalMs;
      },
    },
  );

  const job = data?.data ?? null;
  const isComplete = job ? TERMINAL_STATUSES.includes(job.status) : false;

  return {
    job,
    status: job?.status ?? null,
    progress: job?.progress ?? 0,
    result: job?.result ?? null,
    failedReason: job?.failedReason ?? null,
    isComplete,
    isLoading,
    error,
  };
}
