import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { encrypt, decrypt } from '@airevstream/crypto';
import { getConfig, parsePagination, paginate, PLATFORMS } from '@airevstream/shared';

const createAccountSchema = z.object({
  platform: z.enum(PLATFORMS as unknown as [string, ...string[]]),
  username: z.string().optional(),
  displayName: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateAccountSchema = createAccountSchema.partial();

export async function accountRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List accounts
  app.get('/', async (request, reply) => {
    const { page, limit } = parsePagination(request.query as any);
    const db = getDb();
    const userId = request.user.sub;

    const [items, total] = await Promise.all([
      db.account.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          platform: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          lastSyncedAt: true,
          createdAt: true,
        },
      }),
      db.account.count({ where: { userId } }),
    ]);

    return reply.send({
      success: true,
      data: paginate(items, total, { page, limit }),
    });
  });

  // Get single account
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const account = await db.account.findFirst({
      where: { id, userId: request.user.sub },
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        metadata: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!account) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      });
    }

    return reply.send({ success: true, data: account });
  });

  // Create account
  app.post('/', async (request, reply) => {
    const parsed = createAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const config = getConfig();
    const encKey = config.ENCRYPTION_KEY;

    const data: any = {
      ...parsed.data,
      userId: request.user.sub,
    };

    // Encrypt tokens if encryption key is available
    if (encKey && parsed.data.accessToken) {
      data.accessToken = encrypt(parsed.data.accessToken, encKey);
    }
    if (encKey && parsed.data.refreshToken) {
      data.refreshToken = encrypt(parsed.data.refreshToken, encKey);
    }

    const db = getDb();
    const account = await db.account.create({
      data,
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
    });

    return reply.status(201).send({ success: true, data: account });
  });

  // Update account
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const existing = await db.account.findFirst({ where: { id, userId: request.user.sub } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      });
    }

    const config = getConfig();
    const encKey = config.ENCRYPTION_KEY;
    const data: any = { ...parsed.data };

    if (encKey && parsed.data.accessToken) {
      data.accessToken = encrypt(parsed.data.accessToken, encKey);
    }
    if (encKey && parsed.data.refreshToken) {
      data.refreshToken = encrypt(parsed.data.refreshToken, encKey);
    }

    const account = await db.account.update({
      where: { id },
      data,
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        status: true,
        updatedAt: true,
      },
    });

    return reply.send({ success: true, data: account });
  });

  // Delete account
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const existing = await db.account.findFirst({ where: { id, userId: request.user.sub } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      });
    }

    await db.account.delete({ where: { id } });
    return reply.status(204).send();
  });
}
