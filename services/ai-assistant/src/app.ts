import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fjwt from '@fastify/jwt';
import { getConfig, createLogger } from '@airevstream/shared';
import { authPlugin } from './plugins/auth.js';
import { chatRoutes } from './routes/chat.js';
import { generateRoutes } from './routes/generate.js';

const logger = createLogger('ai-assistant');

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();

  const app = Fastify({ logger: false });

  const allowedOrigins = config.CORS_ORIGINS.split(',');
  await app.register(cors, { origin: allowedOrigins, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  if (!config.JWT_SECRET || config.JWT_SECRET.trim().length < 32) {
    throw new Error(
      'JWT_SECRET is missing or too short (need ≥ 32 chars). ' +
      'Generate one with: openssl rand -hex 64, then put it in .env. ' +
      'Run `make doctor` to verify.',
    );
  }
  await app.register(fjwt, { secret: config.JWT_SECRET });
  await app.register(authPlugin);

  // Routes
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(generateRoutes, { prefix: '/api/generate' });

  // Health
  const healthHandler = async () => ({
    success: true,
    data: { status: 'healthy', service: 'ai-assistant', timestamp: new Date().toISOString() },
  });
  app.get('/api/health', healthHandler);
  app.get('/health', healthHandler);

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    logger.error({ err: error }, 'Request error');
    const statusCode = error.statusCode ?? 500;
    const safeMessages: Record<number, string> = {
      400: 'Bad request',
      401: 'Authentication required',
      403: 'Access denied',
      404: 'Not found',
      409: 'Conflict',
      429: 'Too many requests',
      500: 'Internal server error',
    };
    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: safeMessages[statusCode] ?? 'An error occurred',
      },
    });
  });

  return app;
}
