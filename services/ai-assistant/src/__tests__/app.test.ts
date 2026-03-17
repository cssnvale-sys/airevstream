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

describe('ai-assistant app', () => {
  describe('GET /api/health', () => {
    it('returns health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.service).toBe('ai-assistant');
    });
  });

  describe('GET /api/chat/conversations', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/chat/conversations',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/generate/script', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generate/script',
        payload: { topic: 'test', platform: 'youtube', contentType: 'video' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/generate/ideas', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generate/ideas',
        payload: { niche: 'tech' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/generate/caption', () => {
    it('rejects unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generate/caption',
        payload: { description: 'test', platform: 'instagram' },
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
