import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { encrypt } from '@airevstream/crypto';
import { getConfig, createLogger } from '@airevstream/shared';

const logger = createLogger('routes:account');

const createEmailAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tier: z.enum(['tier1', 'tier2', 'tier3']).default('tier2'),
  notes: z.string().optional(),
});

const updateEmailAccountSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned', 'warming']).optional(),
  tier: z.enum(['tier1', 'tier2', 'tier3']).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const bulkImportSchema = z.object({
  accounts: z.array(z.object({
    email: z.string().email(),
    password: z.string().min(1),
    tier: z.enum(['tier1', 'tier2', 'tier3']).optional(),
  })).min(1).max(500),
});

const createSocialAccountSchema = z.object({
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'facebook']),
  platformUserId: z.string().optional(),
  username: z.string().optional(),
  credentials: z.string().optional(),
});

export async function accountRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List email accounts (paginated, filterable)
  app.get('/', async (request, reply) => {
    const { page = '1', limit = '50', status, tier, search } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tier) where.tier = tier;
    if (search) where.email = { contains: search, mode: 'insensitive' };

    const db = getDb();
    const [items, total] = await Promise.all([
      db.emailAccount.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          socialAccounts: {
            select: { id: true, platform: true, username: true, status: true, healthScore: true },
            orderBy: { platform: 'asc' },
          },
          _count: { select: { socialAccounts: true } },
        },
      }),
      db.emailAccount.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: items,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  });

  // Get email account detail
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const account = await db.emailAccount.findUnique({
      where: { id },
      include: {
        socialAccounts: {
          include: {
            channels: {
              include: {
                channelAvatars: { include: { avatar: true } },
                brandingPackages: true,
                affiliatePool: { include: { affiliateProduct: true } },
              },
            },
          },
        },
      },
    });

    if (!account) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Email account not found' },
      });
    }

    return reply.send({ success: true, data: account });
  });

  // Create email account
  app.post('/', async (request, reply) => {
    const parsed = createEmailAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const config = getConfig();
    if (!config.ENCRYPTION_KEY) {
      logger.warn('ENCRYPTION_KEY not set — storing password in plaintext. Set ENCRYPTION_KEY in .env for production.');
    }
    const passwordEnc = config.ENCRYPTION_KEY
      ? encrypt(parsed.data.password, config.ENCRYPTION_KEY)
      : parsed.data.password;

    const db = getDb();
    const account = await db.emailAccount.create({
      data: {
        email: parsed.data.email,
        passwordEnc,
        tier: parsed.data.tier,
        notes: parsed.data.notes,
      },
    });

    return reply.status(201).send({ success: true, data: account });
  });

  // Update email account
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateEmailAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const updateData: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.tier !== undefined) updateData.tier = parsed.data.tier;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const account = await db.emailAccount.update({
      where: { id },
      data: updateData,
    });

    return reply.send({ success: true, data: account });
  });

  // Delete email account
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();
    await db.emailAccount.delete({ where: { id } });
    return reply.status(204).send();
  });

  // Bulk import email accounts
  app.post('/bulk-import', async (request, reply) => {
    const parsed = bulkImportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }
    const { accounts } = parsed.data;
    const config = getConfig();
    const db = getDb();

    const results = await db.$transaction(
      accounts.map((a) =>
        db.emailAccount.create({
          data: {
            email: a.email,
            passwordEnc: config.ENCRYPTION_KEY ? encrypt(a.password, config.ENCRYPTION_KEY) : a.password,
            tier: a.tier || 'tier2',
          },
        }),
      ),
    );

    return reply.status(201).send({ success: true, data: results, meta: { total: results.length, page: 1, limit: results.length, pages: 1 } });
  });

  // List social accounts for email
  app.get('/:id/socials', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const socials = await db.socialAccount.findMany({
      where: { emailAccountId: id },
      include: {
        channels: { select: { id: true, name: true, primaryLanguage: true, status: true } },
      },
    });

    return reply.send({ success: true, data: socials });
  });

  // Create social account for email
  app.post('/:id/socials', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createSocialAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const config = getConfig();
    const credentialsEnc = parsed.data.credentials && config.ENCRYPTION_KEY
      ? encrypt(parsed.data.credentials, config.ENCRYPTION_KEY)
      : parsed.data.credentials ?? null;

    const db = getDb();
    const social = await db.socialAccount.create({
      data: {
        emailAccountId: id,
        platform: parsed.data.platform,
        platformUserId: parsed.data.platformUserId,
        username: parsed.data.username,
        credentialsEnc,
      },
    });

    return reply.status(201).send({ success: true, data: social });
  });
}
