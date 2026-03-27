import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getDb } from '@airevstream/db';
import { JWT_ACCESS_EXPIRY, createLogger } from '@airevstream/shared';

const logger = createLogger('routes:auth');

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/register', async (request, reply) => {
    try {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid registration data' },
        });
      }

      const { email, password, name } = parsed.data;
      const db = getDb();

      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT_ERROR', message: 'Email already registered' },
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Create tenant + user atomically so neither is orphaned
      const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 100)
        + '-' + Date.now().toString(36);
      const displayName = name ?? email.split('@')[0];

      const user = await db.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: `${displayName}'s Workspace`,
            slug,
          },
        });
        return tx.user.create({
          data: { email, passwordHash, name, tenantId: tenant.id },
          select: { id: true, email: true, name: true, tenantId: true, createdAt: true },
        });
      });

      const token = app.jwt.sign(
        { sub: user.id, email: user.email },
        { expiresIn: JWT_ACCESS_EXPIRY },
      );

      return reply.status(201).send({
        success: true,
        data: { user, token },
      });
    } catch (err) {
      logger.error({ err }, 'POST /register failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Registration failed' },
      });
    }
  });

  // Login
  app.post('/login', async (request, reply) => {
    try {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid login data' },
        });
      }

      const { email, password } = parsed.data;
      const db = getDb();

      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(401).send({
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid credentials' },
        });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid credentials' },
        });
      }

      const token = app.jwt.sign(
        { sub: user.id, email: user.email },
        { expiresIn: JWT_ACCESS_EXPIRY },
      );

      return reply.send({
        success: true,
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          token,
        },
      });
    } catch (err) {
      logger.error({ err }, 'POST /login failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Login failed' },
      });
    }
  });

  // Get current user
  app.get('/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    try {
      const db = getDb();
      const user = await db.user.findUnique({
        where: { id: request.user.sub },
        select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      return reply.send({ success: true, data: user });
    } catch (err) {
      logger.error({ err }, 'GET /me failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' },
      });
    }
  });
}
