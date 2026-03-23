'use client';

import { useApi } from './use-api';
import type { SWRConfiguration } from 'swr';

export function useCohorts<T = unknown>(params?: string, config?: SWRConfiguration) {
  return useApi<T>(`/seasoning/cohorts${params ? `?${params}` : ''}`, config);
}

export function useCohort<T = unknown>(id: string | null, config?: SWRConfiguration) {
  return useApi<T>(id ? `/seasoning/cohorts/${id}` : null, config);
}

export function useEnrollments<T = unknown>(cohortId: string | null, params?: string, config?: SWRConfiguration) {
  return useApi<T>(cohortId ? `/seasoning/cohorts/${cohortId}/enrollments${params ? `?${params}` : ''}` : null, config);
}

export function useEnrollment<T = unknown>(id: string | null, config?: SWRConfiguration) {
  return useApi<T>(id ? `/seasoning/enrollments/${id}` : null, config);
}

export function useSeasoningStats<T = unknown>(config?: SWRConfiguration) {
  return useApi<T>('/seasoning/stats', { refreshInterval: 30000, ...config });
}
