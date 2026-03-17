import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { parsePagination, paginate } from '@airevstream/shared';
import { addJob } from '@airevstream/queue';

const workflowStepSchema = z.object({
  id: z.string(),
  type: z.enum(['research', 'script', 'voiceover', 'image_generation', 'video_assembly', 'review', 'publish']),
  name: z.string(),
  config: z.record(z.unknown()),
  dependsOn: z.array(z.string()).optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  definition: z.object({
    id: z.string(),
    name: z.string(),
    steps: z.array(workflowStepSchema),
  }),
});

const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export async function workflowRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List workflows
  app.get('/', async (request, reply) => {
    const { page, limit } = parsePagination(request.query as any);
    const db = getDb();
    const userId = request.user.sub;

    const [items, total] = await Promise.all([
      db.workflow.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { runs: true } } },
      }),
      db.workflow.count({ where: { userId } }),
    ]);

    return reply.send({
      success: true,
      data: paginate(items, total, { page, limit }),
    });
  });

  // Get single workflow
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const workflow = await db.workflow.findFirst({
      where: { id, userId: request.user.sub },
      include: { runs: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    if (!workflow) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    return reply.send({ success: true, data: workflow });
  });

  // Create workflow
  app.post('/', async (request, reply) => {
    const parsed = createWorkflowSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const workflow = await db.workflow.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        definition: parsed.data.definition as any,
        userId: request.user.sub,
      },
    });

    return reply.status(201).send({ success: true, data: workflow });
  });

  // Update workflow
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateWorkflowSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const existing = await db.workflow.findFirst({ where: { id, userId: request.user.sub } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    const data: any = { ...parsed.data };
    if (parsed.data.definition) {
      data.definition = parsed.data.definition as any;
    }

    const workflow = await db.workflow.update({ where: { id }, data });
    return reply.send({ success: true, data: workflow });
  });

  // Delete workflow
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const existing = await db.workflow.findFirst({ where: { id, userId: request.user.sub } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    await db.workflow.delete({ where: { id } });
    return reply.status(204).send();
  });

  // Execute workflow
  app.post('/:id/run', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const workflow = await db.workflow.findFirst({ where: { id, userId: request.user.sub } });
    if (!workflow) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    // Create a workflow run
    const run = await db.workflowRun.create({
      data: {
        workflowId: id,
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Queue the first step for processing
    await addJob('content', 'content:generate', {
      contentId: run.id,
      userId: request.user.sub,
      type: 'workflow',
    });

    return reply.status(202).send({ success: true, data: run });
  });

  // Get workflow runs
  app.get('/:id/runs', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { page, limit } = parsePagination(request.query as any);
    const db = getDb();

    const workflow = await db.workflow.findFirst({ where: { id, userId: request.user.sub } });
    if (!workflow) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    const [items, total] = await Promise.all([
      db.workflowRun.findMany({
        where: { workflowId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.workflowRun.count({ where: { workflowId: id } }),
    ]);

    return reply.send({
      success: true,
      data: paginate(items, total, { page, limit }),
    });
  });
}
