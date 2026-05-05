import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import '@fastify/jwt';
import fp from 'fastify-plugin';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('plugins:auth');

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    jwtVerify(): Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

async function authPluginFn(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      logger.warn({ err, url: request.url, method: request.method }, 'Authentication failed');
      reply.status(401).send({
        success: false,
        error: { code: 'AUTHENTICATION_ERROR', message: 'Authentication required' },
      });
    }
  });
}

export const authPlugin = fp(authPluginFn, { name: 'auth-plugin' });
