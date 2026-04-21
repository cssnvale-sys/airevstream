import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { createLogger } from '@airevstream/shared';
import type { Prisma } from '@prisma/client';
import { resolveTenantId, getTenantScope } from '../lib/tenant.js';

const logger = createLogger('routes:workflow');

const createJobSchema = z.object({
  jobType: z.enum(['content_production', 'account_creation', 'warming', 'research', 'posting', 'maintenance', 'health_check']),
  priority: z.number().min(1).max(10).default(5),
  channelId: z.string().uuid().optional(),
  contentId: z.string().uuid().optional(),
  emailAccountId: z.string().uuid().optional(),
  params: z.record(z.unknown()).default({}),
});

const WORKFLOW_SORT_FIELDS = ['createdAt', 'updatedAt', 'priority', 'status', 'jobType'] as const;

export async function workflowRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List workflow jobs (paginated, filterable)
  app.get('/', async (request, reply) => {
    try {
      const tenantId = await resolveTenantId(request, reply);
      if (!tenantId) return;
      const { channelIds, emailAccountIds } = await getTenantScope(tenantId);

      const { page = '1', limit = '50', status, jobType, sort = 'createdAt', order = 'desc' } = request.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const skip = (pageNum - 1) * limitNum;
      const db = getDb();

      // Scope to tenant resources
      const tenantFilter: Prisma.WorkflowJobWhereInput = {
        OR: [
          { content: { channelId: { in: channelIds } } },
          { channelId: { in: channelIds } },
          { emailAccountId: { in: emailAccountIds } },
        ],
      };

      const where: Prisma.WorkflowJobWhereInput = { ...tenantFilter };
      if (status) where.status = status;
      if (jobType) where.jobType = jobType;

      const safeSort = (WORKFLOW_SORT_FIELDS as readonly string[]).includes(sort) ? sort : 'createdAt';
      const safeOrder = order === 'asc' ? 'asc' : 'desc';

      const [items, total] = await Promise.all([
        db.workflowJob.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { [safeSort]: safeOrder },
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
    } catch (err) {
      logger.error({ err }, 'GET /workflows failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list workflow jobs' },
      });
    }
  });

  // Get job detail
  app.get('/:id', async (request, reply) => {
    try {
      const tenantId = await resolveTenantId(request, reply);
      if (!tenantId) return;
      const { channelIds, emailAccountIds } = await getTenantScope(tenantId);

      const { id } = request.params as { id: string };
      const db = getDb();

      const job = await db.workflowJob.findFirst({
        where: {
          id,
          OR: [
            { content: { channelId: { in: channelIds } } },
            { channelId: { in: channelIds } },
            { emailAccountId: { in: emailAccountIds } },
          ],
        },
        include: { content: true },
      });

      if (!job) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
      }

      return reply.send({ success: true, data: job });
    } catch (err) {
      logger.error({ err }, 'GET /workflows/:id failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch workflow job' },
      });
    }
  });

  // Create workflow job
  app.post('/', async (request, reply) => {
    try {
      const tenantId = await resolveTenantId(request, reply);
      if (!tenantId) return;

      const parsed = createJobSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid workflow job data' },
        });
      }

      // Verify referenced entities belong to tenant
      const db = getDb();
      if (parsed.data.channelId) {
        const ch = await db.channel.findFirst({
          where: { id: parsed.data.channelId, socialAccount: { emailAccount: { tenantId } } },
          select: { id: true },
        });
        if (!ch) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Channel not found' } });
        }
      }
      if (parsed.data.emailAccountId) {
        const ea = await db.emailAccount.findFirst({
          where: { id: parsed.data.emailAccountId, tenantId },
          select: { id: true },
        });
        if (!ea) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Email account not found' } });
        }
      }
      if (parsed.data.contentId) {
        const ci = await db.contentItem.findFirst({
          where: { id: parsed.data.contentId, channel: { socialAccount: { emailAccount: { tenantId } } } },
          select: { id: true },
        });
        if (!ci) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Content not found' } });
        }
      }

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
    } catch (err) {
      logger.error({ err }, 'POST /workflows failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create workflow job' },
      });
    }
  });

  // Cancel job
  app.post('/:id/cancel', async (request, reply) => {
    try {
      const tenantId = await resolveTenantId(request, reply);
      if (!tenantId) return;
      const { channelIds, emailAccountIds } = await getTenantScope(tenantId);

      const { id } = request.params as { id: string };
      const db = getDb();

      const job = await db.workflowJob.findFirst({
        where: {
          id,
          OR: [
            { content: { channelId: { in: channelIds } } },
            { channelId: { in: channelIds } },
            { emailAccountId: { in: emailAccountIds } },
          ],
        },
      });
      if (!job) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
      }

      if (job.status === 'completed' || job.status === 'cancelled') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Cannot cancel a completed or cancelled job' },
        });
      }

      const updated = await db.workflowJob.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      return reply.send({ success: true, data: updated });
    } catch (err) {
      logger.error({ err }, 'POST /workflows/:id/cancel failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel workflow job' },
      });
    }
  });

  // Complete HITL task
  app.post('/:id/human-complete', async (request, reply) => {
    try {
      const tenantId = await resolveTenantId(request, reply);
      if (!tenantId) return;
      const { channelIds, emailAccountIds } = await getTenantScope(tenantId);

      const { id } = request.params as { id: string };
      const db = getDb();

      const job = await db.workflowJob.findFirst({
        where: {
          id,
          needsHuman: true,
          OR: [
            { content: { channelId: { in: channelIds } } },
            { channelId: { in: channelIds } },
            { emailAccountId: { in: emailAccountIds } },
          ],
        },
      });
      if (!job) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No HITL task found' } });
      }

      const updated = await db.workflowJob.update({
        where: { id },
        data: { needsHuman: false, humanCompletedAt: new Date(), status: 'running' },
      });

      return reply.send({ success: true, data: updated });
    } catch (err) {
      logger.error({ err }, 'POST /workflows/:id/human-complete failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to complete HITL task' },
      });
    }
  });

  // Trigger content production pipeline
  app.post('/pipeline/content', async (request, reply) => {
    const pipelineSchema = z.object({
      contentId: z.string().uuid(),
      channelId: z.string().uuid(),
      topic: z.string().min(1).max(1000),
      contentType: z.string().min(1),
      domain: z.string().optional(),
    });

    const parsed = pipelineSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid pipeline request data' },
      });
    }

    try {
      const tenantId = await resolveTenantId(request, reply);
      if (!tenantId) return;

      const { startContentPipeline } = await import('@airevstream/queue');
      const result = await startContentPipeline({ ...parsed.data, tenantId });
      return reply.status(201).send({ success: true, data: { flowJobId: result.job.id } });
    } catch (err) {
      logger.error({ err }, 'POST /workflows/pipeline/content failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to start content pipeline' },
      });
    }
  });

  // Get active workflows summary
  app.get('/summary/active', async (request, reply) => {
    try {
      const tenantId = await resolveTenantId(request, reply);
      if (!tenantId) return;
      const { channelIds, emailAccountIds } = await getTenantScope(tenantId);

      const db = getDb();
      const tenantFilter: Prisma.WorkflowJobWhereInput = {
        OR: [
          { content: { channelId: { in: channelIds } } },
          { channelId: { in: channelIds } },
          { emailAccountId: { in: emailAccountIds } },
        ],
      };

      const [running, queued, paused, needsHuman] = await Promise.all([
        db.workflowJob.count({ where: { ...tenantFilter, status: 'running' } }),
        db.workflowJob.count({ where: { ...tenantFilter, status: 'queued' } }),
        db.workflowJob.count({ where: { ...tenantFilter, status: 'paused' } }),
        db.workflowJob.count({ where: { ...tenantFilter, needsHuman: true, humanCompletedAt: null } }),
      ]);

      // Count by job type
      const byType = await db.workflowJob.groupBy({
        by: ['jobType'],
        where: { ...tenantFilter, status: { in: ['running', 'queued'] } },
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
    } catch (err) {
      logger.error({ err }, 'GET /workflows/summary/active failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch workflow summary' },
      });
    }
  });
}
