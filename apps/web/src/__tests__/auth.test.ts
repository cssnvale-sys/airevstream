import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
};

// Make window defined so getToken() doesn't early-return null
Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true });
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'document', {
  value: { cookie: '' },
  writable: true,
});

// Helper to create a fake JWT
function createFakeJWT(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe('lib/auth', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    document.cookie = '';
  });

  describe('getToken', () => {
    it('returns null when no token stored', async () => {
      const { getToken } = await import('../lib/auth');
      expect(getToken()).toBeNull();
    });

    it('returns stored token', async () => {
      store['airevstream_token'] = 'test-token';
      const { getToken } = await import('../lib/auth');
      expect(getToken()).toBe('test-token');
    });
  });

  describe('setToken', () => {
    it('stores token in localStorage', async () => {
      const { setToken } = await import('../lib/auth');
      setToken('my-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('airevstream_token', 'my-token');
    });
  });

  describe('removeToken', () => {
    it('removes token from localStorage', async () => {
      store['airevstream_token'] = 'old-token';
      const { removeToken } = await import('../lib/auth');
      removeToken();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('airevstream_token');
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no token', async () => {
      const { isAuthenticated } = await import('../lib/auth');
      expect(isAuthenticated()).toBe(false);
    });

    it('returns true for valid JWT with future expiry', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = createFakeJWT({ sub: 'user-1', exp: futureExp });
      store['airevstream_token'] = token;

      const { isAuthenticated } = await import('../lib/auth');
      expect(isAuthenticated()).toBe(true);
    });

    it('returns false for expired JWT and removes token', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const token = createFakeJWT({ sub: 'user-1', exp: pastExp });
      store['airevstream_token'] = token;

      const { isAuthenticated } = await import('../lib/auth');
      expect(isAuthenticated()).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('airevstream_token');
    });

    it('returns true for JWT without exp field', async () => {
      const token = createFakeJWT({ sub: 'user-1' });
      store['airevstream_token'] = token;

      const { isAuthenticated } = await import('../lib/auth');
      expect(isAuthenticated()).toBe(true);
    });

    it('returns false for malformed JWT', async () => {
      store['airevstream_token'] = 'not-a-jwt';

      const { isAuthenticated } = await import('../lib/auth');
      expect(isAuthenticated()).toBe(false);
    });

    it('returns false for JWT with invalid base64 payload', async () => {
      store['airevstream_token'] = 'header.!!!invalid!!!.sig';

      const { isAuthenticated } = await import('../lib/auth');
      expect(isAuthenticated()).toBe(false);
    });
  });
});
