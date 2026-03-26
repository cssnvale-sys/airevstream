'use client';

import { useApi } from '@/hooks/use-api';

// Avatars
export function useAvatars<T = unknown>(params?: string) {
  return useApi<T>(`/avatars${params ? `?${params}` : ''}`);
}

export function useAvatar<T = unknown>(id: string | null) {
  return useApi<T>(id ? `/avatars/${id}` : null);
}

// Scenery
export function useSceneryAssets<T = unknown>(params?: string) {
  return useApi<T>(`/scenery${params ? `?${params}` : ''}`);
}

export function useSceneryAsset<T = unknown>(id: string | null) {
  return useApi<T>(id ? `/scenery/${id}` : null);
}

// Branding
export function useBrandingPackage<T = unknown>(channelId: string | null) {
  return useApi<T>(channelId ? `/channels/${channelId}/branding` : null);
}

// Channel Assets (aggregated)
export function useChannelAssets<T = unknown>(channelId: string | null) {
  return useApi<T>(channelId ? `/channels/${channelId}/assets` : null);
}

// Channel Scenery
export function useChannelScenery<T = unknown>(channelId: string | null) {
  return useApi<T>(channelId ? `/channels/${channelId}/scenery` : null);
}

// Asset Registry
export function useAssetRegistry<T = unknown>(params?: string) {
  return useApi<T>(`/assets${params ? `?${params}` : ''}`);
}
