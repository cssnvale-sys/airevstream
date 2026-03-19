'use client';

import useSWR from 'swr';
import { getToken } from '@/lib/auth';

const API_BASE = '/api/v1';

async function fetchPresignedUrl(url: string) {
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.url ?? null;
}

/**
 * Hook to fetch a presigned URL for a MinIO object.
 * Caches for 50 minutes (URLs expire in 60 min).
 */
export function usePresignedUrl(bucket: string | null, key: string | null) {
  const shouldFetch = bucket && key;
  const { data: url, error, isLoading } = useSWR<string | null>(
    shouldFetch ? `${API_BASE}/media/url?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}` : null,
    fetchPresignedUrl,
    {
      dedupingInterval: 50 * 60 * 1000, // 50 min cache
      revalidateOnFocus: false,
    },
  );

  return { url: url ?? null, error, isLoading };
}
