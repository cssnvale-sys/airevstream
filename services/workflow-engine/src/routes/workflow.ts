import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import type { Prisma } from '@prisma/client';

const createJobSchema = z.object({
  jobType: z.enum(['content_production', 'account_creation', 'warming', 'research', 'posting', 'maintenance', 'health_check']),
  priority: z.number().min(1).max(10).default(5),
  channelId: z.string().uuid().optional(),
  contentId: z.string().uuid().optional(),
  emailAccountId: z.string().uuid().optional(),
  params: z.record(z.unknown()).default({}),
});

export async function workflowRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List workflow jobs (paginated, filterable)
  app.get('/', async (request, reply) => {
    const { page = '1', limit = '50', status, jobType, sort = 'createdAt', order = 'desc' } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const db = getDb();

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (jobType) where.jobType = jobType;

    const [items, total] = await Promise.all([
      db.workflowJob.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sort]: order },
        include: {
          content: { select: { id: true, title: true, contentType: true } },
        },
      }),
      db.workflowJob.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: items,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  });

  // Get job detail
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const job = await db.workflowJob.findUnique({
      where: { id },
      include: { content: true },
    });

    if (!job) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }

    return reply.send({ success: true, data: job });
  });

  // Create workflow job
  app.post('/', async (request, reply) => {
    const parsed = createJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const job = await db.workflowJob.create({
      data: {
        jobType: parsed.data.jobType,
        priority: parsed.data.priority,
        channelId: parsed.data.channelId,
        contentId: parsed.data.contentId,
        emailAccountId: parsed.data.emailAccountId,
        params: parsed.data.params as Prisma.InputJsonValue,
      },
    });

    return reply.status(201).send({ success: true, data: job });
  });

  // Cancel job
  app.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const job = await db.workflowJob.findUnique({ where: { id } });
    if (!job) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_STATE', message: `Cannot cancel job in ${job.status} state` },
      });
    }

    const updated = await db.workflowJob.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return reply.send({ success: true, data: updated });
  });

  // Complete HITL task
  app.post('/:id/human-complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const job = await db.workflowJob.findUnique({ where: { id } });
    if (!job || !job.needsHuman) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No HITL task found' } });
    }

    const updated = await db.workflowJob.update({
      where: { id },
      data: { needsHuman: false, humanCompletedAt: new Date(), status: 'running' },
    });

    return reply.send({ success: true, data: updated });
  });

  // Get active workflows summary
  app.get('/summary/active', async (request, reply) => {
    const db = getDb();

    const [running, queued, paused, needsHuman] = await Promise.all([
      db.workflowJob.count({ where: { status: 'running' } }),
      db.workflowJob.count({ where: { status: 'queued' } }),
      db.workflowJob.count({ where: { status: 'paused' } }),
      db.workflowJob.count({ where: { needsHuman: true, humanCompletedAt: null } }),
    ]);

    // Count by job type
    const byType = await db.workflowJob.groupBy({
      by: ['jobType'],
      where: { status: { in: ['running', 'queued'] } },
      _count: true,
    });

    return reply.send({
      success: true,
      data: {
        running,
        queued,
        paused,
        needsHuman,
        byType: byType.map((t) => ({ jobType: t.jobType, count: t._count })),
      },
    });
  });
}
