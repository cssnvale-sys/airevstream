import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getDb } from '@airevstream/db';
import { JWT_ACCESS_EXPIRY } from '@airevstream/shared';

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
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
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
    const user = await db.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const token = app.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: JWT_ACCESS_EXPIRY },
    );

    return reply.status(201).send({
      success: true,
      data: { user, token },
    });
  });

  // Login
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
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
  });

  // Get current user
  app.get('/me', { onRequest: [app.authenticate] }, async (request, reply) => {
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
  });
}
