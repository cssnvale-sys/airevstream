'use client';

import { useApi } from './use-api';
import type { SWRConfiguration } from 'swr';

export function useExperiments<T = unknown>(params?: string, config?: SWRConfiguration) {
  return useApi<T>(`/experiments${params ? `?${params}` : ''}`, config);
}

export function useExperiment<T = unknown>(id: string | null, config?: SWRConfiguration) {
  return useApi<T>(id ? `/experiments/${id}` : null, config);
}

export function useExperimentVariants<T = unknown>(experimentId: string | null, config?: SWRConfiguration) {
  return useApi<T>(experimentId ? `/experiments/${experimentId}/variants` : null, config);
}
