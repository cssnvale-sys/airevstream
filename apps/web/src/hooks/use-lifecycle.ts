'use client';

import { useApi, apiPost } from '@/hooks/use-api';
import type { PlatformDiscoveryResult } from '@airevstream/shared';

interface LifecycleResponse {
  lifecycle: {
    id: string;
    status: string;
    targetPlatforms: string[];
    discoveryResults: Record<string, PlatformDiscoveryResult>;
    avatarId: string | null;
    autoSeasoning: boolean;
    autoPosting: boolean;
    cohortId: string | null;
    currentStep: string | null;
    error: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

interface ActiveLifecycleItem {
  id: string;
  emailAccountId: string;
  email: string;
  status: string;
  targetPlatforms: string[];
  currentStep: string | null;
  discoveryResults: Record<string, PlatformDiscoveryResult>;
  startedAt: string | null;
  createdAt: string;
}

/**
 * Fetch lifecycle status for a specific email account.
 * Polls every 5s when lifecycle is active.
 */
export function useLifecycle(emailAccountId: string | undefined) {
  const { data, error, isLoading, mutate } = useApi<LifecycleResponse>(
    emailAccountId ? `/accounts/${emailAccountId}/lifecycle` : null,
    { refreshInterval: 5000 },
  );

  return {
    lifecycle: data?.data?.lifecycle ?? null,
    error,
    isLoading,
    mutate,
  };
}

/**
 * Fetch all active lifecycles for the dashboard.
 */
export function useActiveLifecycles() {
  const { data, error, isLoading, mutate } = useApi<ActiveLifecycleItem[]>('/lifecycle/active');

  return {
    lifecycles: data?.data ?? [],
    error,
    isLoading,
    mutate,
  };
}

/**
 * Start a lifecycle pipeline for an email account.
 */
export async function startLifecycle(
  emailAccountId: string,
  params: {
    targetPlatforms: string[];
    avatarId?: string;
    autoSeasoning?: boolean;
    autoPosting?: boolean;
  },
) {
  return apiPost<{ success: boolean; data: { jobId: string; status: string } }>(
    `/accounts/${emailAccountId}/lifecycle`,
    params,
  );
}

/**
 * Retry a failed lifecycle pipeline.
 */
export async function retryLifecycle(emailAccountId: string) {
  return apiPost<{ success: boolean; data: { jobId: string; status: string } }>(
    `/accounts/${emailAccountId}/lifecycle/retry`,
    {},
  );
}
