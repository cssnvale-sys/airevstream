'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import { getToken, removeToken } from '@/lib/auth';

const API_BASE = '/api/v1';

async function fetcher(url: string) {
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  if (!res.ok) throw new Error(data.error?.message ?? 'Request failed');
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
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Request failed');
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
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Request failed');
  return data;
}

export async function apiDelete(path: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json();
    throw new Error(data.error?.message ?? 'Request failed');
  }
}

// Typed hooks for common data patterns
export function useAccounts(params?: string) {
  return useApi(`/accounts${params ? `?${params}` : ''}`);
}

export function useAccount(id: string | null) {
  return useApi(id ? `/accounts/${id}` : null);
}

export function useChannels(params?: string) {
  return useApi(`/channels${params ? `?${params}` : ''}`);
}

export function useChannel(id: string | null) {
  return useApi(id ? `/channels/${id}` : null);
}

export function useContent(params?: string) {
  return useApi(`/content${params ? `?${params}` : ''}`);
}

export function useContentItem(id: string | null) {
  return useApi(id ? `/content/${id}` : null);
}

export function useApprovals(params?: string) {
  return useApi(`/approvals${params ? `?${params}` : ''}`);
}

export function useCalendar(params?: string) {
  return useApi(`/calendar${params ? `?${params}` : ''}`);
}

export function useAffiliateProducts(params?: string) {
  return useApi(`/affiliate/products${params ? `?${params}` : ''}`);
}

export function useAiServices() {
  return useApi('/ai-services');
}

export function useSystemHealth() {
  return useApi('/system/health', { refreshInterval: 30000 });
}

export function useSystemMetrics() {
  return useApi('/system/metrics', { refreshInterval: 15000 });
}

export function useAlerts(params?: string) {
  return useApi(`/system/alerts${params ? `?${params}` : ''}`);
}

export function useWorkflows(params?: string) {
  return useApi(`/system/workflows${params ? `?${params}` : ''}`);
}

export function useAnalytics(type: string, params?: string) {
  return useApi(`/analytics/${type}${params ? `?${params}` : ''}`);
}
