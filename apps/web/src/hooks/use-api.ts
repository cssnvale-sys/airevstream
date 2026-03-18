'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import { getToken, removeToken } from '@/lib/auth';

const API_BASE = '/api/v1';

async function fetcher(url: string) {
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      removeToken();
      window.location.href = '/auth/login';
    }
    throw new Error('Session expired');
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Request failed with status ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error?.message ?? data.error?.code ?? 'Request failed');
  return data;
}

export function useApi<T = unknown>(path: string | null, config?: SWRConfiguration) {
  return useSWR<{ success: boolean; data: T; meta?: { total: number; page: number; limit: number; pages: number } }>(
    path ? `${API_BASE}${path}` : null,
    fetcher,
    config,
  );
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Request failed with status ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error?.message ?? data.error?.code ?? 'Request failed');
  return data;
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Request failed with status ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error?.message ?? data.error?.code ?? 'Request failed');
  return data;
}

export async function apiDelete(path: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok && res.status !== 204) {
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Request failed with status ${res.status}`);
    }
    throw new Error(data.error?.message ?? data.error?.code ?? 'Request failed');
  }
}

// Typed hooks for common data patterns
export function useAccounts<T = unknown>(params?: string) {
  return useApi<T>(`/accounts${params ? `?${params}` : ''}`);
}

export function useAccount<T = unknown>(id: string | null) {
  return useApi<T>(id ? `/accounts/${id}` : null);
}

export function useChannels<T = unknown>(params?: string) {
  return useApi<T>(`/channels${params ? `?${params}` : ''}`);
}

export function useChannel<T = unknown>(id: string | null) {
  return useApi<T>(id ? `/channels/${id}` : null);
}

export function useContent<T = unknown>(params?: string) {
  return useApi<T>(`/content${params ? `?${params}` : ''}`);
}

export function useContentItem<T = unknown>(id: string | null) {
  return useApi<T>(id ? `/content/${id}` : null);
}

export function useApprovals<T = unknown>(params?: string) {
  return useApi<T>(`/approvals${params ? `?${params}` : ''}`);
}

export function useCalendar<T = unknown>(params?: string) {
  return useApi<T>(`/calendar${params ? `?${params}` : ''}`);
}

export function useAffiliateProducts<T = unknown>(params?: string) {
  return useApi<T>(`/affiliate/products${params ? `?${params}` : ''}`);
}

export function useAiServices<T = unknown>() {
  return useApi<T>('/ai-services');
}

export function useSystemHealth<T = unknown>() {
  return useApi<T>('/system/health', { refreshInterval: 30000 });
}

export function useSystemMetrics<T = unknown>() {
  return useApi<T>('/system/metrics', { refreshInterval: 15000 });
}

export function useAlerts<T = unknown>(params?: string) {
  return useApi<T>(`/system/alerts${params ? `?${params}` : ''}`);
}

export function useWorkflows<T = unknown>(params?: string) {
  return useApi<T>(`/system/workflows${params ? `?${params}` : ''}`);
}

export function useAnalytics<T = unknown>(type: string, params?: string) {
  return useApi<T>(`/analytics/${type}${params ? `?${params}` : ''}`);
}
