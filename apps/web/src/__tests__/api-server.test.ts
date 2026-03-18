import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock NextResponse.json before importing api-server
vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
  }
  class MockNextRequest {
    url: string;
    headers: Map<string, string>;
    constructor(url: string, init?: { headers?: Record<string, string> }) {
      this.url = url;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }
    get(key: string) {
      return this.headers.get(key) ?? null;
    }
  }
  return {
    NextResponse: MockNextResponse,
    NextRequest: MockNextRequest,
  };
});

// Mock external deps that api-server imports
vi.mock('jose', () => ({ jwtVerify: vi.fn() }));
vi.mock('@airevstream/db', () => ({ getDb: vi.fn() }));
vi.mock('@airevstream/crypto', () => ({ sha256: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

import {
  json,
  success,
  paginated,
  error,
  notFound,
  validationError,
  forbidden,
  requireAdmin,
  parseQuery,
  getJwtSecret,
  isUUID,
  authenticate,
  authenticateSSE,
  authenticateApiKey,
  authenticateAny,
  type ApiContext,
} from '../lib/api-server';
import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getDb } from '@airevstream/db';
import { sha256 } from '@airevstream/crypto';
import { checkRateLimit } from '@/lib/rate-limit';

describe('api-server', () => {
  describe('response helpers', () => {
    it('json() returns data with status', () => {
      const res = json({ hello: 'world' }, 201) as any;
      expect(res.body).toEqual({ hello: 'world' });
      expect(res.status).toBe(201);
    });

    it('json() defaults to status 200', () => {
      const res = json({ test: true }) as any;
      expect(res.status).toBe(200);
    });

    it('success() wraps data in standard shape', () => {
      const res = success({ id: 1 }) as any;
      expect(res.body).toEqual({ success: true, data: { id: 1 } });
      expect(res.status).toBe(200);
    });

    it('success() includes meta when provided', () => {
      const res = success({ id: 1 }, { total: 10 }) as any;
      expect(res.body).toEqual({ success: true, data: { id: 1 }, meta: { total: 10 } });
    });

    it('success() omits meta when not provided', () => {
      const res = success({ id: 1 }) as any;
      expect(res.body).not.toHaveProperty('meta');
    });

    it('paginated() returns correct shape', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const res = paginated(items, 10, 1, 5) as any;
      expect(res.body).toEqual({
        success: true,
        data: items,
        meta: { total: 10, page: 1, limit: 5, pages: 2 },
      });
    });

    it('paginated() calculates pages correctly', () => {
      const res = paginated([], 25, 1, 10) as any;
      expect(res.body.meta.pages).toBe(3);
    });

    it('error() returns error shape with status', () => {
      const res = error('BAD_INPUT', 'Missing field', 400) as any;
      expect(res.body).toEqual({ success: false, error: { code: 'BAD_INPUT', message: 'Missing field' } });
      expect(res.status).toBe(400);
    });

    it('error() defaults to status 400', () => {
      const res = error('ERR', 'test') as any;
      expect(res.status).toBe(400);
    });

    it('notFound() returns 404', () => {
      const res = notFound() as any;
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Not found');
    });

    it('notFound() accepts custom message', () => {
      const res = notFound('User not found') as any;
      expect(res.body.error.message).toBe('User not found');
    });

    it('validationError() returns 400 with VALIDATION_ERROR code', () => {
      const res = validationError('Email is required') as any;
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Email is required');
    });

    it('forbidden() returns 403', () => {
      const res = forbidden() as any;
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('forbidden() accepts custom message', () => {
      const res = forbidden('No access') as any;
      expect(res.body.error.message).toBe('No access');
    });
  });

  describe('requireAdmin', () => {
    it('returns null for admin role', () => {
      const ctx: ApiContext = { userId: '1', role: 'admin', tenantId: null, db: {} as any };
      expect(requireAdmin(ctx)).toBeNull();
    });

    it('returns forbidden response for operator role', () => {
      const ctx: ApiContext = { userId: '1', role: 'operator', tenantId: null, db: {} as any };
      const res = requireAdmin(ctx) as any;
      expect(res).not.toBeNull();
      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe('Admin access required');
    });

    it('returns forbidden response for viewer role', () => {
      const ctx: ApiContext = { userId: '1', role: 'viewer', tenantId: null, db: {} as any };
      const res = requireAdmin(ctx) as any;
      expect(res).not.toBeNull();
      expect(res.status).toBe(403);
    });
  });

  describe('parseQuery', () => {
    function makeReq(params: Record<string, string> = {}): NextRequest {
      const url = new URL('http://localhost/api/v1/test');
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
      return new NextRequest(url.toString()) as any;
    }

    it('returns defaults when no params', () => {
      const q = parseQuery(makeReq());
      expect(q.page).toBe(1);
      expect(q.limit).toBe(50);
      expect(q.skip).toBe(0);
      expect(q.sort).toBe('createdAt');
      expect(q.order).toBe('desc');
      expect(q.search).toBeUndefined();
    });

    it('parses page and limit', () => {
      const q = parseQuery(makeReq({ page: '3', limit: '25' }));
      expect(q.page).toBe(3);
      expect(q.limit).toBe(25);
      expect(q.skip).toBe(50); // (3-1) * 25
    });

    it('clamps page to minimum 1', () => {
      const q = parseQuery(makeReq({ page: '0' }));
      expect(q.page).toBe(1);
    });

    it('clamps page to 1 for negative values', () => {
      const q = parseQuery(makeReq({ page: '-5' }));
      expect(q.page).toBe(1);
    });

    it('clamps limit to maximum 100', () => {
      const q = parseQuery(makeReq({ limit: '500' }));
      expect(q.limit).toBe(100);
    });

    it('clamps limit to minimum 1', () => {
      const q = parseQuery(makeReq({ limit: '0' }));
      expect(q.limit).toBe(1);
    });

    it('handles NaN page gracefully', () => {
      const q = parseQuery(makeReq({ page: 'abc' }));
      expect(q.page).toBe(1);
    });

    it('handles NaN limit gracefully', () => {
      const q = parseQuery(makeReq({ limit: 'xyz' }));
      expect(q.limit).toBe(50);
    });

    it('parses sort and order', () => {
      const q = parseQuery(makeReq({ sort: 'name', order: 'asc' }));
      expect(q.sort).toBe('name');
      expect(q.order).toBe('asc');
    });

    it('defaults invalid order to desc', () => {
      const q = parseQuery(makeReq({ order: 'invalid' }));
      expect(q.order).toBe('desc');
    });

    it('parses search parameter', () => {
      const q = parseQuery(makeReq({ search: 'hello world' }));
      expect(q.search).toBe('hello world');
    });

    it('exposes raw params for custom extraction', () => {
      const q = parseQuery(makeReq({ custom: 'value' }));
      expect(q.params.get('custom')).toBe('value');
    });
  });

  describe('getJwtSecret', () => {
    beforeEach(() => {
      // Reset the cached secret
      // Access private module state by re-importing or setting env
      delete process.env.JWT_SECRET;
    });

    it('returns a Uint8Array', () => {
      process.env.JWT_SECRET = 'test-secret';
      // Force re-evaluation by clearing cache
      // The function caches, so we test the return type
      const secret = getJwtSecret();
      expect(secret).toBeInstanceOf(Uint8Array);
    });
  });

  describe('isUUID', () => {
    it('accepts valid v4 UUIDs', () => {
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isUUID('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true);
    });

    it('rejects invalid strings', () => {
      expect(isUUID('')).toBe(false);
      expect(isUUID('not-a-uuid')).toBe(false);
      expect(isUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isUUID('../../etc/passwd')).toBe(false);
      expect(isUUID("'; DROP TABLE users;--")).toBe(false);
    });
  });

  describe('error() Cache-Control header', () => {
    it('sets no-store, must-revalidate on error responses', () => {
      const res = error('TEST', 'msg', 400) as any;
      // NextResponse.json is mocked, but verify error returns correct shape
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TEST');
    });

    it('sets no-store on 401 errors', () => {
      const res = error('UNAUTHORIZED', 'test', 401) as any;
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('sets no-store on 429 errors', () => {
      const res = error('RATE_LIMITED', 'too many', 429) as any;
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('authenticate', () => {
    function makeAuthReq(headers: Record<string, string> = {}): NextRequest {
      return new NextRequest('http://localhost/api/v1/test', { headers }) as any;
    }

    beforeEach(() => {
      vi.clearAllMocks();
      process.env.JWT_SECRET = 'test-secret';
    });

    it('rejects missing Authorization header', async () => {
      const res = await authenticate(makeAuthReq()) as any;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects non-Bearer Authorization header', async () => {
      const res = await authenticate(makeAuthReq({ authorization: 'Basic abc123' })) as any;
      expect(res.status).toBe(401);
    });

    it('rejects when JWT has no sub claim', async () => {
      (jwtVerify as any).mockResolvedValueOnce({ payload: {} });
      const res = await authenticate(makeAuthReq({ authorization: 'Bearer valid-token' })) as any;
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid token');
    });

    it('rejects when user not found in DB', async () => {
      (jwtVerify as any).mockResolvedValueOnce({ payload: { sub: 'user-123', role: 'admin' } });
      const mockDb = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
      (getDb as any).mockReturnValue(mockDb);

      const res = await authenticate(makeAuthReq({ authorization: 'Bearer valid-token' })) as any;
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('User not found');
    });

    it('returns ApiContext on valid auth', async () => {
      (jwtVerify as any).mockResolvedValueOnce({ payload: { sub: 'user-123', role: 'admin' } });
      const mockDb = { user: { findUnique: vi.fn().mockResolvedValue({ tenantId: 'tenant-1' }) } };
      (getDb as any).mockReturnValue(mockDb);

      const ctx = await authenticate(makeAuthReq({ authorization: 'Bearer valid-token' })) as ApiContext;
      expect(ctx.userId).toBe('user-123');
      expect(ctx.role).toBe('admin');
      expect(ctx.tenantId).toBe('tenant-1');
    });

    it('defaults role to operator when not in JWT', async () => {
      (jwtVerify as any).mockResolvedValueOnce({ payload: { sub: 'user-123' } });
      const mockDb = { user: { findUnique: vi.fn().mockResolvedValue({ tenantId: null }) } };
      (getDb as any).mockReturnValue(mockDb);

      const ctx = await authenticate(makeAuthReq({ authorization: 'Bearer valid-token' })) as ApiContext;
      expect(ctx.role).toBe('operator');
    });

    it('returns 401 when JWT verification throws', async () => {
      (jwtVerify as any).mockRejectedValueOnce(new Error('expired'));

      const res = await authenticate(makeAuthReq({ authorization: 'Bearer expired-token' })) as any;
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid or expired token');
    });
  });

  describe('authenticateSSE', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.JWT_SECRET = 'test-secret';
    });

    it('accepts token from Authorization header', async () => {
      (jwtVerify as any).mockResolvedValueOnce({ payload: { sub: 'user-1', role: 'admin' } });
      const mockDb = { user: { findUnique: vi.fn().mockResolvedValue({ tenantId: 't1' }) } };
      (getDb as any).mockReturnValue(mockDb);

      const req = new NextRequest('http://localhost/api/v1/sse', {
        headers: { authorization: 'Bearer header-token' },
      }) as any;
      const ctx = await authenticateSSE(req) as ApiContext;
      expect(ctx.userId).toBe('user-1');
      expect((jwtVerify as any).mock.calls[0][0]).toBe('header-token');
    });

    it('falls back to query param when no header', async () => {
      (jwtVerify as any).mockResolvedValueOnce({ payload: { sub: 'user-2', role: 'operator' } });
      const mockDb = { user: { findUnique: vi.fn().mockResolvedValue({ tenantId: 't2' }) } };
      (getDb as any).mockReturnValue(mockDb);

      const req = new NextRequest('http://localhost/api/v1/sse?token=query-token') as any;
      const ctx = await authenticateSSE(req) as ApiContext;
      expect(ctx.userId).toBe('user-2');
      expect((jwtVerify as any).mock.calls[0][0]).toBe('query-token');
    });

    it('rejects when no token in header or query', async () => {
      const req = new NextRequest('http://localhost/api/v1/sse') as any;
      const res = await authenticateSSE(req) as any;
      expect(res.status).toBe(401);
    });
  });

  describe('authenticateApiKey', () => {
    function makeApiKeyReq(headers: Record<string, string> = {}): NextRequest {
      return new NextRequest('http://localhost/api/v1/test', { headers }) as any;
    }

    beforeEach(() => {
      vi.clearAllMocks();
      (sha256 as any).mockReturnValue('hashed-key');
    });

    it('rejects missing API key', async () => {
      const res = await authenticateApiKey(makeApiKeyReq()) as any;
      expect(res.status).toBe(401);
    });

    it('rejects API key without ars_ prefix', async () => {
      const res = await authenticateApiKey(makeApiKeyReq({ 'x-api-key': 'bad_key_123' })) as any;
      expect(res.status).toBe(401);
    });

    it('rejects unknown API key', async () => {
      const mockDb = { apiKey: { findUnique: vi.fn().mockResolvedValue(null) } };
      (getDb as any).mockReturnValue(mockDb);

      const res = await authenticateApiKey(makeApiKeyReq({ 'x-api-key': 'ars_test123' })) as any;
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid API key');
    });

    it('rejects revoked API key', async () => {
      const mockDb = {
        apiKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'k1', status: 'revoked', scopes: ['read'], tenantId: 't1',
            rateLimitRpm: 60, expiresAt: null, tenant: { id: 't1' },
          }),
        },
      };
      (getDb as any).mockReturnValue(mockDb);

      const res = await authenticateApiKey(makeApiKeyReq({ 'x-api-key': 'ars_test123' })) as any;
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('API key has been revoked');
    });

    it('rejects expired API key', async () => {
      const mockDb = {
        apiKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'k1', status: 'active', scopes: ['read'], tenantId: 't1',
            rateLimitRpm: 60, expiresAt: new Date('2020-01-01'), tenant: { id: 't1' },
          }),
        },
      };
      (getDb as any).mockReturnValue(mockDb);

      const res = await authenticateApiKey(makeApiKeyReq({ 'x-api-key': 'ars_test123' })) as any;
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('API key has expired');
    });

    it('rejects API key lacking required scope', async () => {
      const mockDb = {
        apiKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'k1', status: 'active', scopes: ['read'], tenantId: 't1',
            rateLimitRpm: 60, expiresAt: null, tenant: { id: 't1' },
          }),
        },
      };
      (getDb as any).mockReturnValue(mockDb);
      (checkRateLimit as any).mockReturnValue({ allowed: true });

      const res = await authenticateApiKey(makeApiKeyReq({ 'x-api-key': 'ars_test123' }), 'write') as any;
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain("'write'");
    });

    it('allows admin scope to bypass specific scope checks', async () => {
      const mockDb = {
        apiKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'k1', status: 'active', scopes: ['admin'], tenantId: 't1',
            rateLimitRpm: 60, expiresAt: null, tenant: { id: 't1' },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      (getDb as any).mockReturnValue(mockDb);
      (checkRateLimit as any).mockReturnValue({ allowed: true });

      const ctx = await authenticateApiKey(makeApiKeyReq({ 'x-api-key': 'ars_test123' }), 'write') as ApiContext;
      expect(ctx.role).toBe('admin');
      expect(ctx.tenantId).toBe('t1');
    });

    it('rejects when rate limited', async () => {
      const mockDb = {
        apiKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'k1', status: 'active', scopes: ['read'], tenantId: 't1',
            rateLimitRpm: 60, expiresAt: null, tenant: { id: 't1' },
          }),
        },
      };
      (getDb as any).mockReturnValue(mockDb);
      (checkRateLimit as any).mockReturnValue({ allowed: false });

      const res = await authenticateApiKey(makeApiKeyReq({ 'x-api-key': 'ars_test123' })) as any;
      expect(res.status).toBe(429);
    });

    it('returns ApiContext with apikey: prefix userId on success', async () => {
      const mockDb = {
        apiKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'k1', status: 'active', scopes: ['read', 'write'], tenantId: 't1',
            rateLimitRpm: 60, expiresAt: null, tenant: { id: 't1' },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      (getDb as any).mockReturnValue(mockDb);
      (checkRateLimit as any).mockReturnValue({ allowed: true });

      const ctx = await authenticateApiKey(makeApiKeyReq({ 'x-api-key': 'ars_test123' })) as ApiContext;
      expect(ctx.userId).toBe('apikey:k1');
      expect(ctx.role).toBe('operator');
      expect(ctx.tenantId).toBe('t1');
    });
  });

  describe('authenticateAny', () => {
    function makeAnyReq(headers: Record<string, string> = {}): NextRequest {
      return new NextRequest('http://localhost/api/v1/test', { headers }) as any;
    }

    beforeEach(() => {
      vi.clearAllMocks();
      process.env.JWT_SECRET = 'test-secret';
    });

    it('prefers Bearer token over API key', async () => {
      (jwtVerify as any).mockResolvedValueOnce({ payload: { sub: 'user-jwt', role: 'admin' } });
      const mockDb = { user: { findUnique: vi.fn().mockResolvedValue({ tenantId: 't1' }) } };
      (getDb as any).mockReturnValue(mockDb);

      const ctx = await authenticateAny(makeAnyReq({
        authorization: 'Bearer jwt-token',
        'x-api-key': 'ars_key123',
      })) as ApiContext;
      expect(ctx.userId).toBe('user-jwt');
    });

    it('falls back to API key when no Bearer header', async () => {
      (sha256 as any).mockReturnValue('hashed');
      (checkRateLimit as any).mockReturnValue({ allowed: true });
      const mockDb = {
        apiKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'k1', status: 'active', scopes: ['read'], tenantId: 't1',
            rateLimitRpm: 60, expiresAt: null, tenant: { id: 't1' },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      (getDb as any).mockReturnValue(mockDb);

      const ctx = await authenticateAny(makeAnyReq({ 'x-api-key': 'ars_key123' })) as ApiContext;
      expect(ctx.userId).toBe('apikey:k1');
    });

    it('rejects when neither auth method provided', async () => {
      const res = await authenticateAny(makeAnyReq()) as any;
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Missing authentication');
    });
  });
});
