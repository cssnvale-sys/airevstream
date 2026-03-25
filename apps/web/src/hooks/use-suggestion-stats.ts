'use client';

import { useApi } from './use-api';
import type { SWRConfiguration } from 'swr';

export function useSuggestionStats<T = unknown>(params?: string, config?: SWRConfiguration) {
  return useApi<T>(`/suggestions/stats${params ? `?${params}` : ''}`, config);
}
