import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { addJob } from '@airevstream/queue';
import type { Prisma } from '@prisma/client';

const CONTENT_SORT_FIELDS = ['createdAt', 'updatedAt', 'title', 'status', 'contentType', 'qualityScore'] as const;

const updateContentSchema = z.object({
  title: z.string().max(500).optional(),
  status: z.enum(['draft', 'generating', 'pending_approval', 'approved', 'scheduled', 'posted', 'failed', 'archived']).optional(),
  prompt: z.string().max(10000).optional(),
  platformMetadata: z.record(z.unknown()).optional(),
});

const bulkApprovalSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['approve', 'reject']),
});

const createContentSchema = z.object({
  channelId: z.string().uuid(),
  title: z.string().max(500).optional(),
  contentType: z.enum(['text', 'image', 'video_short', 'video_long', 'voice', 'thumbnail']),
  contentPurpose: z.enum(['entertainment', 'sales', 'educational', 'comedy', 'affiliate']).optional(),
  prompt: z.string().optional(),
  language: z.string().default('en'),
  affiliateProductId: z.string().uuid().optional(),
  affiliateMode: z.enum(['dedicated', 'commercial_break', 'none']).optional(),
});

export async function contentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List content items (paginated, filterable)
  app.get('/', async (request, reply) => {
    const {
      page = '1', limit = '50', status, contentType, channelId, search, sort = 'createdAt', order = 'desc',
    } = request.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (contentType) where.contentType = contentType;
    if (channelId) where.channelId = channelId;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const safeSort = (CONTENT_SORT_FIELDS as readonly string[]).includes(sort) ? sort : 'createdAt';
    const safeOrder = order === 'asc' ? 'asc' : 'desc';

    const db = getDb();
    const [items, total] = await Promise.all([
      db.contentItem.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [safeSort]: safeOrder },
        include: {
          channel: { select: { id: true, name: true, primaryLanguage: true } },
          aiService: { select: { id: true, name: true, provider: true } },
        },
      }),
      db.contentItem.count({ where }),
    ]);

    // Wrap Decimal fields for JSON serialization
    const serializedItems = items.map((item) => ({
      ...item,
      qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
    }));

    return reply.send({
      success: true,
      data: serializedItems,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  });

  // Get content detail
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const content = await db.contentItem.findUnique({
      where: { id },
      include: {
        channel: true,
        aiService: true,
        affiliateProduct: true,
        storyboards: { include: { shots: { orderBy: { shotNumber: 'asc' } } } },
        scheduledPosts: true,
        children: { select: { id: true, version: true, status: true, createdAt: true } },
      },
    });

    if (!content) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Content not found' },
      });
    }

    // Wrap Decimal fields for JSON serialization
    const serializedContent = {
      ...content,
      qualityScore: content.qualityScore != null ? Number(content.qualityScore) : null,
      storyboards: content.storyboards.map((sb) => ({
        ...sb,
        totalDurationSec: sb.totalDurationSec != null ? Number(sb.totalDurationSec) : null,
        shots: sb.shots.map((shot) => ({
          ...shot,
          startSec: shot.startSec != null ? Number(shot.startSec) : null,
          endSec: shot.endSec != null ? Number(shot.endSec) : null,
          qualityScore: shot.qualityScore != null ? Number(shot.qualityScore) : null,
        })),
      })),
    };

    return reply.send({ success: true, data: serializedContent });
  });

  // Start content generation
  app.post('/generate', async (request, reply) => {
    const parsed = createContentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const content = await db.contentItem.create({
      data: {
        channelId: parsed.data.channelId,
        title: parsed.data.title,
        contentType: parsed.data.contentType,
        contentPurpose: parsed.data.contentPurpose,
        prompt: parsed.data.prompt,
        language: parsed.data.language,
        affiliateProductId: parsed.data.affiliateProductId,
        affiliateMode: parsed.data.affiliateMode,
        status: 'generating',
      },
    });

    await addJob('content', 'content:generate', {
      contentId: content.id,
      channelId: parsed.data.channelId,
      contentType: parsed.data.contentType,
      prompt: parsed.data.prompt,
    });

    return reply.status(201).send({ success: true, data: content });
  });

  // Update content metadata
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateContentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.prompt !== undefined) updateData.prompt = parsed.data.prompt;
    if (parsed.data.platformMetadata !== undefined) updateData.platformMetadata = parsed.data.platformMetadata;

    const content = await db.contentItem.update({
      where: { id },
      data: updateData,
    });

    return reply.send({ success: true, data: content });
  });

  // Approve content
  app.post('/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const content = await db.contentItem.update({
      where: { id },
      data: { status: 'approved', approvedAt: new Date(), approvedBy: request.user?.sub ?? 'system' },
    });

    return reply.send({ success: true, data: content });
  });

  // Reject content
  app.post('/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { feedback } = request.body as { feedback?: string };
    const db = getDb();

    const content = await db.contentItem.update({
      where: { id },
      data: { status: 'draft' },
    });

    await db.actionAuditLog.create({
      data: { actionType: 'content.reject', tier: 2, parameters: { contentId: id, feedback } as Prisma.InputJsonValue, status: 'completed' },
    });

    return reply.send({ success: true, data: content });
  });

  // Regenerate content (creates new version)
  app.post('/:id/regenerate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const existing = await db.contentItem.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Content not found' } });
    }

    const newContent = await db.contentItem.create({
      data: {
        channelId: existing.channelId,
        title: existing.title,
        contentType: existing.contentType,
        contentPurpose: existing.contentPurpose,
        prompt: existing.prompt,
        language: existing.language,
        affiliateProductId: existing.affiliateProductId,
        affiliateMode: existing.affiliateMode,
        parentId: existing.id,
        version: existing.version + 1,
        status: 'generating',
      },
    });

    await addJob('content', 'content:generate', {
      contentId: newContent.id,
      channelId: existing.channelId,
      contentType: existing.contentType,
      prompt: existing.prompt ?? undefined,
    });

    return reply.status(201).send({ success: true, data: newContent });
  });

  // Get content versions
  app.get('/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const content = await db.contentItem.findUnique({ where: { id } });
    if (!content) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Content not found' } });
    }

    const rootId = content.parentId ?? content.id;
    const versions = await db.contentItem.findMany({
      where: { OR: [{ id: rootId }, { parentId: rootId }] },
      orderBy: { version: 'asc' },
      select: { id: true, version: true, status: true, qualityScore: true, createdAt: true },
    });

    // Wrap Decimal fields for JSON serialization
    const serializedVersions = versions.map((v) => ({
      ...v,
      qualityScore: v.qualityScore != null ? Number(v.qualityScore) : null,
    }));

    return reply.send({ success: true, data: serializedVersions });
  });

  // Get storyboard for content
  app.get('/:id/storyboard', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const storyboard = await db.storyboard.findFirst({
      where: { contentId: id },
      include: { shots: { orderBy: { shotNumber: 'asc' } } },
    });

    if (!storyboard) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No storyboard for this content' } });
    }

    // Wrap Decimal fields for JSON serialization
    const serializedStoryboard = storyboard ? {
      ...storyboard,
      totalDurationSec: storyboard.totalDurationSec != null ? Number(storyboard.totalDurationSec) : null,
      shots: storyboard.shots.map((shot) => ({
        ...shot,
        startSec: shot.startSec != null ? Number(shot.startSec) : null,
        endSec: shot.endSec != null ? Number(shot.endSec) : null,
        qualityScore: shot.qualityScore != null ? Number(shot.qualityScore) : null,
      })),
    } : storyboard;

    return reply.send({ success: true, data: serializedStoryboard });
  });

  // List pending approvals
  app.get('/approvals/pending', async (request, reply) => {
    const { page = '1', limit = '50' } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;
    const db = getDb();

    const where = { status: 'pending_approval' };
    const [items, total] = await Promise.all([
      db.contentItem.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'asc' },
        include: {
          channel: { select: { id: true, name: true, primaryLanguage: true } },
          aiService: { select: { id: true, name: true } },
        },
      }),
      db.contentItem.count({ where }),
    ]);

    // Wrap Decimal fields for JSON serialization
    const serializedItems = items.map((item) => ({
      ...item,
      qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
    }));

    return reply.send({
      success: true,
      data: serializedItems,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  });

  // Bulk approve/reject
  app.post('/approvals/bulk', async (request, reply) => {
    const parsed = bulkApprovalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }
    const { ids, action } = parsed.data;
    const db = getDb();

    const updateData = action === 'approve'
      ? { status: 'approved', approvedAt: new Date(), approvedBy: request.user?.sub ?? 'system' }
      : { status: 'draft' };

    const result = await db.contentItem.updateMany({
      where: { id: { in: ids }, status: 'pending_approval' },
      data: updateData,
    });

    return reply.send({ success: true, data: { updated: result.count } });
  });
}
