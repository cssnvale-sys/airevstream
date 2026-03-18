'use client';

const TOKEN_KEY = 'airevstream_token';
const AUTH_COOKIE = 'airevstream_auth';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Set session indicator cookie so middleware can gate protected routes
  document.cookie = `${AUTH_COOKIE}=1; path=/; samesite=strict`;
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  // Clear session indicator cookie
  document.cookie = `${AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      removeToken();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
