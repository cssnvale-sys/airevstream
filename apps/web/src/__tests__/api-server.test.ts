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
  type ApiContext,
} from '../lib/api-server';
import { NextRequest } from 'next/server';

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
});
