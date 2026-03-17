import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fjwt from '@fastify/jwt';
import { getConfig, createLogger } from '@airevstream/shared';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { contentRoutes } from './routes/content.js';
import { accountRoutes } from './routes/account.js';
import { workflowRoutes } from './routes/workflow.js';

const logger = createLogger('workflow-engine');

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();

  const app = Fastify({
    logger: false,
  });

  // Plugins
  await app.register(cors, { origin: true, credentials: true });

  if (!config.JWT_SECRET) {
    logger.warn('JWT_SECRET not set — using fallback for development only');
  }
  await app.register(fjwt, {
    secret: config.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
  });

  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes, { prefix: '/api/health' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(contentRoutes, { prefix: '/api/content' });
  await app.register(accountRoutes, { prefix: '/api/accounts' });
  await app.register(workflowRoutes, { prefix: '/api/workflows' });

  // Global error handler
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
