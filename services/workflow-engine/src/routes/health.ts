import { type FastifyInstance } from 'fastify';
import { getDb } from '@airevstream/db';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    try {
      await getDb().$queryRaw`SELECT 1`;
      return reply.send({
        success: true,
        data: {
          status: 'healthy',
          service: 'workflow-engine',
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      return reply.status(503).send({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database connection failed' },
      });
    }
  });
}
