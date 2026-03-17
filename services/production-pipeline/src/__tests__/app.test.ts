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

describe('production-pipeline app', () => {
  describe('GET /api/health', () => {
    it('returns health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.service).toBe('production-pipeline');
    });
  });

  describe('POST /api/images/generate', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/images/generate',
        payload: { contentId: '123', workflow: 'character' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/videos/render', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/videos/render',
        payload: { contentId: '123' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/videos/audio', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/videos/audio',
        payload: { contentId: '123', text: 'hello' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/assets/content/:id', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/assets/content/123',
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
