'use client';

import { useApi } from './use-api';
import type { SWRConfiguration } from 'swr';

export function useChannelViralStats<T = unknown>(id: string | null, config?: SWRConfiguration) {
  return useApi<T>(id ? `/channels/${id}/viral-stats` : null, config);
}

export function useChannelTopicSuggestions<T = unknown>(id: string | null, config?: SWRConfiguration) {
  return useApi<T>(id ? `/channels/${id}/topic-suggestions` : null, config);
}
