'use client';

import { useApi } from './use-api';
import type { SWRConfiguration } from 'swr';

export function useSeries<T = unknown>(params?: string, config?: SWRConfiguration) {
  return useApi<T>(`/series${params ? `?${params}` : ''}`, config);
}

export function useSeriesDetail<T = unknown>(id: string | null, config?: SWRConfiguration) {
  return useApi<T>(id ? `/series/${id}` : null, config);
}

export function useSeriesEpisodes<T = unknown>(seriesId: string | null, params?: string, config?: SWRConfiguration) {
  return useApi<T>(seriesId ? `/series/${seriesId}/episodes${params ? `?${params}` : ''}` : null, config);
}

export function useSeriesAvatars<T = unknown>(seriesId: string | null, config?: SWRConfiguration) {
  return useApi<T>(seriesId ? `/series/${seriesId}/avatars` : null, config);
}

export function useSeriesBible<T = unknown>(seriesId: string | null, config?: SWRConfiguration) {
  return useApi<T>(seriesId ? `/series/${seriesId}/bible` : null, config);
}

export function useSeriesPresets<T = unknown>(seriesId: string | null, config?: SWRConfiguration) {
  return useApi<T>(seriesId ? `/series/${seriesId}/presets` : null, config);
}

export function useSeriesAnalytics<T = unknown>(seriesId: string | null, config?: SWRConfiguration) {
  return useApi<T>(seriesId ? `/series/${seriesId}/analytics` : null, config);
}

export function useChannelSeries<T = unknown>(channelId: string | null, config?: SWRConfiguration) {
  return useApi<T>(channelId ? `/channels/${channelId}/series` : null, config);
}
