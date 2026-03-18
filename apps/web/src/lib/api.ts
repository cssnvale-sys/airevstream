import { getToken } from './auth';

const API_BASE = '/api/v1';

type FetchOptions = {
  method?: string;
  body?: unknown;
};

async function request<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return {} as T;

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Request failed');
  }

  return data;
}

// ─── Auth ───

export const auth = {
  register: (email: string, password: string, name?: string) =>
    request<any>('/auth/register', { method: 'POST', body: { email, password, name } }),

  login: (email: string, password: string) =>
    request<any>('/auth/login', { method: 'POST', body: { email, password } }),

  me: () => request<any>('/auth/me'),
};

// ─── Content ───

export const content = {
  list: (params?: string) => request<any>(`/content${params ? `?${params}` : ''}`),
  get: (id: string) => request<any>(`/content/${id}`),
  generate: (data: { channelId: string; contentType: string; title?: string; prompt?: string }) =>
    request<any>('/content/generate', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    request<any>(`/content/${id}`, { method: 'PUT', body: data }),
  approve: (id: string) => request<any>(`/content/${id}/approve`, { method: 'POST' }),
  reject: (id: string, feedback?: string) =>
    request<any>(`/content/${id}/reject`, { method: 'POST', body: { feedback } }),
  regenerate: (id: string) => request<any>(`/content/${id}/regenerate`, { method: 'POST' }),
};

// ─── Accounts ───

export const accounts = {
  list: (params?: string) => request<any>(`/accounts${params ? `?${params}` : ''}`),
  get: (id: string) => request<any>(`/accounts/${id}`),
  create: (data: { email: string; password: string; tier?: string; notes?: string }) =>
    request<any>('/accounts', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    request<any>(`/accounts/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => request<any>(`/accounts/${id}`, { method: 'DELETE' }),
  bulkImport: (accounts: Array<{ email: string; password: string; tier?: string }>) =>
    request<any>('/accounts/bulk-import', { method: 'POST', body: { accounts } }),
};

// ─── Channels ───

export const channels = {
  list: (params?: string) => request<any>(`/channels${params ? `?${params}` : ''}`),
  get: (id: string) => request<any>(`/channels/${id}`),
  create: (data: Record<string, unknown>) =>
    request<any>('/channels', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    request<any>(`/channels/${id}`, { method: 'PUT', body: data }),
};

// ─── AI Chat ───

export const chat = {
  send: (message: string, conversationId?: string, contextPage?: string) =>
    request<any>('/assistant/chat', { method: 'POST', body: { message, conversationId, contextPage } }),
  listConversations: () => request<any>('/assistant/conversations'),
  getConversation: (id: string) => request<any>(`/assistant/conversations/${id}`),
  deleteConversation: (id: string) =>
    request<any>(`/assistant/conversations/${id}`, { method: 'DELETE' }),
};

// ─── AI Generate ───

export const generate = {
  script: (data: { topic: string; platform: string; contentType: string }) =>
    request<any>('/assistant/chat', { method: 'POST', body: { message: `Generate a ${data.contentType} script about "${data.topic}" for ${data.platform}` } }),
  ideas: (data: { niche: string; platform?: string; count?: number }) =>
    request<any>('/assistant/chat', { method: 'POST', body: { message: `Generate ${data.count ?? 5} content ideas for "${data.niche}" niche${data.platform ? ` on ${data.platform}` : ''}` } }),
};
