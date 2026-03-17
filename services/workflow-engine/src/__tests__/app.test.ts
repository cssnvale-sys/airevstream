import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('workflow-engine app', () => {
  describe('GET /api/health', () => {
    it('returns health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      // May fail if DB is not available, which is fine for unit tests
      expect([200, 503]).toContain(response.statusCode);
      const body = response.json();
      expect(body).toHaveProperty('success');
    });
  });

  describe('POST /api/auth/register', () => {
    it('rejects invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'not-an-email', password: 'password123' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: 'short' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/content', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/content',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/accounts', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/accounts',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/workflows', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workflows',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
