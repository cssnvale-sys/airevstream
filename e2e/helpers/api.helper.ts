import { Page } from '@playwright/test';

/**
 * Make authenticated API calls via page.evaluate (uses the page's cookies/localStorage).
 */

async function apiFetch(
  page: Page,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  return page.evaluate(
    async ({ method, url, body }) => {
      const token = localStorage.getItem('airevstream_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      return { status: res.status, data };
    },
    { method, url, body },
  );
}

export async function apiGet(page: Page, url: string) {
  return apiFetch(page, 'GET', url);
}

export async function apiPost(page: Page, url: string, body?: unknown) {
  return apiFetch(page, 'POST', url, body);
}

export async function apiPut(page: Page, url: string, body?: unknown) {
  return apiFetch(page, 'PUT', url, body);
}

export async function apiDelete(page: Page, url: string) {
  return apiFetch(page, 'DELETE', url);
}
