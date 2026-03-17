import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fjwt from '@fastify/jwt';
import { getConfig, createLogger } from '@airevstream/shared';
import { authPlugin } from './plugins/auth.js';
import { chatRoutes } from './routes/chat.js';
import { generateRoutes } from './routes/generate.js';

const logger = createLogger('ai-assistant');

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();

  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(fjwt, {
    secret: config.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
  });
  await app.register(authPlugin);

  // Routes
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(generateRoutes, { prefix: '/api/generate' });

  // Health
  app.get('/api/health', async () => ({
    success: true,
    data: { status: 'healthy', service: 'ai-assistant', timestamp: new Date().toISOString() },
  }));

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    logger.error({ err: error }, 'Request error');
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: (error as any).code ?? 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'Internal server error' : error.message,
      },
    });
  });

  return app;
}
