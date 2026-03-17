import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fjwt from '@fastify/jwt';
import { getConfig, createLogger } from '@airevstream/shared';
import { authPlugin } from './plugins/auth.js';
import { imageRoutes } from './routes/image.js';
import { videoRoutes } from './routes/video.js';
import { assetRoutes } from './routes/asset.js';

const logger = createLogger('production-pipeline');

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();

  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(fjwt, {
    secret: config.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
  });
  await app.register(authPlugin);

  // Routes
  await app.register(imageRoutes, { prefix: '/api/images' });
  await app.register(videoRoutes, { prefix: '/api/videos' });
  await app.register(assetRoutes, { prefix: '/api/assets' });

  // Health
  app.get('/api/health', async () => ({
    success: true,
    data: { status: 'healthy', service: 'production-pipeline', timestamp: new Date().toISOString() },
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
