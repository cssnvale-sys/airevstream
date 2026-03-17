import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { parsePagination, paginate } from '@airevstream/shared';

const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['video', 'image', 'text', 'story', 'reel', 'short']),
  script: z.string().optional(),
  tags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
});

const updateContentSchema = createContentSchema.partial().extend({
  status: z.enum(['draft', 'review', 'approved', 'scheduled']).optional(),
});

export async function contentRoutes(app: FastifyInstance) {
  // All routes require auth
  app.addHook('onRequest', app.authenticate);

  // List content
  app.get('/', async (request, reply) => {
    const { page, limit } = parsePagination(request.query as any);
    const db = getDb();
    const userId = request.user.sub;

    const [items, total] = await Promise.all([
      db.content.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { assets: true, postings: true } } },
      }),
      db.content.count({ where: { userId } }),
    ]);

    return reply.send({
      success: true,
      data: paginate(items, total, { page, limit }),
    });
  });

  // Get single content
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const content = await db.content.findFirst({
      where: { id, userId: request.user.sub },
      include: { assets: true, postings: { include: { account: true } } },
    });

    if (!content) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Content not found' },
      });
    }

    return reply.send({ success: true, data: content });
  });

  // Create content
  app.post('/', async (request, reply) => {
    const parsed = createContentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const content = await db.content.create({
      data: {
        ...parsed.data,
        userId: request.user.sub,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      },
    });

    return reply.status(201).send({ success: true, data: content });
  });

  // Update content
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateContentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const existing = await db.content.findFirst({ where: { id, userId: request.user.sub } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Content not found' },
      });
    }

    const content = await db.content.update({
      where: { id },
      data: {
        ...parsed.data,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      },
    });

    return reply.send({ success: true, data: content });
  });

  // Delete content
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const existing = await db.content.findFirst({ where: { id, userId: request.user.sub } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Content not found' },
      });
    }

    await db.content.delete({ where: { id } });
    return reply.status(204).send();
  });
}
