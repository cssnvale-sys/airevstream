const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const AI_API_BASE = process.env.NEXT_PUBLIC_AI_API_URL ?? 'http://localhost:3003';
const PRODUCTION_API_BASE = process.env.NEXT_PUBLIC_PRODUCTION_API_URL ?? 'http://localhost:3002';

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string;
};

async function request<T = unknown>(baseUrl: string, path: string, options: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Request failed');
  }

  return data;
}

// ─── Auth ───

export const auth = {
  register: (email: string, password: string, name?: string) =>
    request<any>(API_BASE, '/api/auth/register', { method: 'POST', body: { email, password, name } }),

  login: (email: string, password: string) =>
    request<any>(API_BASE, '/api/auth/login', { method: 'POST', body: { email, password } }),

  me: (token: string) =>
    request<any>(API_BASE, '/api/auth/me', { token }),
};

// ─── Content ───

export const content = {
  list: (token: string, page = 1, limit = 20) =>
    request<any>(API_BASE, `/api/content?page=${page}&limit=${limit}`, { token }),

  get: (token: string, id: string) =>
    request<any>(API_BASE, `/api/content/${id}`, { token }),

  create: (token: string, data: { title: string; type: string; description?: string; tags?: string[] }) =>
    request<any>(API_BASE, '/api/content', { method: 'POST', body: data, token }),

  update: (token: string, id: string, data: Record<string, unknown>) =>
    request<any>(API_BASE, `/api/content/${id}`, { method: 'PATCH', body: data, token }),

  delete: (token: string, id: string) =>
    request<any>(API_BASE, `/api/content/${id}`, { method: 'DELETE', token }),
};

// ─── Accounts ───

export const accounts = {
  list: (token: string, page = 1, limit = 20) =>
    request<any>(API_BASE, `/api/accounts?page=${page}&limit=${limit}`, { token }),

  get: (token: string, id: string) =>
    request<any>(API_BASE, `/api/accounts/${id}`, { token }),

  create: (token: string, data: { platform: string; username?: string; displayName?: string }) =>
    request<any>(API_BASE, '/api/accounts', { method: 'POST', body: data, token }),

  delete: (token: string, id: string) =>
    request<any>(API_BASE, `/api/accounts/${id}`, { method: 'DELETE', token }),
};

// ─── Workflows ───

export const workflows = {
  list: (token: string, page = 1, limit = 20) =>
    request<any>(API_BASE, `/api/workflows?page=${page}&limit=${limit}`, { token }),

  get: (token: string, id: string) =>
    request<any>(API_BASE, `/api/workflows/${id}`, { token }),

  create: (token: string, data: { name: string; description?: string; definition: any }) =>
    request<any>(API_BASE, '/api/workflows', { method: 'POST', body: data, token }),

  run: (token: string, id: string) =>
    request<any>(API_BASE, `/api/workflows/${id}/run`, { method: 'POST', token }),

  delete: (token: string, id: string) =>
    request<any>(API_BASE, `/api/workflows/${id}`, { method: 'DELETE', token }),
};

// ─── AI Chat ───

export const chat = {
  listConversations: (token: string) =>
    request<any>(AI_API_BASE, '/api/chat/conversations', { token }),

  getConversation: (token: string, id: string) =>
    request<any>(AI_API_BASE, `/api/chat/conversations/${id}`, { token }),

  createConversation: (token: string) =>
    request<any>(AI_API_BASE, '/api/chat/conversations', { method: 'POST', token }),

  sendMessage: (token: string, conversationId: string, content: string) =>
    request<any>(AI_API_BASE, `/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST', body: { content }, token,
    }),

  deleteConversation: (token: string, id: string) =>
    request<any>(AI_API_BASE, `/api/chat/conversations/${id}`, { method: 'DELETE', token }),
};

// ─── AI Generate ───

export const generate = {
  script: (token: string, data: { topic: string; platform: string; contentType: string }) =>
    request<any>(AI_API_BASE, '/api/generate/script', { method: 'POST', body: data, token }),

  ideas: (token: string, data: { niche: string; platform?: string; count?: number }) =>
    request<any>(AI_API_BASE, '/api/generate/ideas', { method: 'POST', body: data, token }),

  caption: (token: string, data: { description: string; platform: string; hashtags?: boolean }) =>
    request<any>(AI_API_BASE, '/api/generate/caption', { method: 'POST', body: data, token }),
};
