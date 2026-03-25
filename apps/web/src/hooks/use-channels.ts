'use client';

import { useApi } from './use-api';
import type { SWRConfiguration } from 'swr';

export function useChannels<T = unknown>(params?: string, config?: SWRConfiguration) {
  return useApi<T>(`/channels${params ? `?${params}` : ''}`, config);
}

export function useChannel<T = unknown>(id: string | null, config?: SWRConfiguration) {
  return useApi<T>(id ? `/channels/${id}` : null, config);
}
