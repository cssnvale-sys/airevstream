import { NextRequest, NextResponse } from 'next/server';
import { authenticate, authenticateAny, success, error, paginated, parseQuery, validationError, forbidden, formatZodErrors , type ApiContext } from '@/lib/api-server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticateAny(req, 'read');
    if (ctx instanceof NextResponse) return ctx;

    const { page, limit, skip, sort, order, search, params } = parseQuery(req);

    const status = params.get('status') ?? undefined;
    const contentType = params.get('contentType') ?? undefined;
    const channelId = params.get('channelId') ?? undefined;
    const aiServiceId = params.get('aiServiceId') ?? undefined;
    const dateFrom = params.get('dateFrom') ?? undefined;
    const dateTo = params.get('dateTo') ?? undefined;

    const validStatuses = ['draft', 'generating', 'generated', 'pending_approval', 'approved', 'scheduled', 'posted', 'archived', 'failed'];
    const validContentTypes = ['video_short', 'video_long', 'image', 'text', 'voice', 'thumbnail'];

    // Unconditional tenant guard (D071)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const where: Prisma.ContentItemWhereInput = {
      // Tenant scoping through channel → socialAccount → emailAccount
      channel: {
        socialAccount: {
          emailAccount: { tenantId: ctx.tenantId },
        },
      },
    };

    if (status && validStatuses.includes(status)) {
      where.status = status;
    }
    if (contentType && validContentTypes.includes(contentType)) {
      where.contentType = contentType;
    }
    if (channelId) {
      where.channelId = channelId;
    }
    if (aiServiceId) {
      where.aiServiceId = aiServiceId;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { prompt: { contains: search, mode: 'insensitive' } },
      ];
    }
    // Date range filtering (server-side)
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (!isNaN(from.getTime())) (where.createdAt as Prisma.DateTimeFilter).gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (!isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          (where.createdAt as Prisma.DateTimeFilter).lte = to;
        }
      }
    }

    const allowedSortFields = [
      'createdAt', 'updatedAt', 'title', 'status', 'contentType', 'version', 'qualityScore',
    ];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      ctx.db.contentItem.findMany({
        where,
        include: {
          channel: {
            select: { id: true, name: true, primaryLanguage: true },
          },
          aiService: {
            select: { id: true, name: true },
          },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.contentItem.count({ where }),
    ]);

    const converted = items.map((item) => ({
      ...item,
      qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
      durationSec: item.durationSec != null ? Number(item.durationSec) : null,
      approvalGateWindowHrs: item.approvalGateWindowHrs != null ? Number(item.approvalGateWindowHrs) : null,
    }));
    return paginated(converted, total, page, limit);
  } catch (err) {
    logger.error('GET /api/v1/content error:', err as Error, { userId: ctx && !(ctx instanceof NextResponse) ? (ctx as ApiContext).userId : undefined });
    return error('INTERNAL_ERROR', 'Failed to fetch content', 500);
  }
}

const createContentSchema = z.object({
  channelId: z.string().uuid(),
  title: z.string().min(1).max(500),
  contentType: z.enum(['video_short', 'video_long', 'image', 'text', 'voice', 'thumbnail']),
  platforms: z.array(z.string()).optional(),
  script: z.string().optional(),
  shots: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    description: z.string(),
    duration: z.number(),
    imageUrl: z.string().optional(),
  })).optional(),
  affiliateProductId: z.string().uuid().optional(),
  affiliateMode: z.string().optional(),
  status: z.enum(['draft', 'generating', 'generated', 'pending_approval', 'approved', 'scheduled', 'posted', 'archived', 'failed']).optional(),
});

export async function POST(req: NextRequest) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content-create:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
    }

    const body = await req.json();
    const parsed = createContentSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { channelId, title, contentType, script, shots, status, affiliateProductId, affiliateMode } = parsed.data;

    // Unconditional tenant guard (D071)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    // Verify channel exists and belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id: channelId,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });

    if (!channel) {
      return error('NOT_FOUND', 'Channel not found', 404);
    }

    // Atomically create the ContentItem and, if shots were provided by the
    // create wizard, persist them as a Storyboard + StoryboardShot graph so
    // the production pipeline worker can pick them up. Previously only the
    // raw shot list was dropped into generationParams.shots as a blob, which
    // meant every downstream worker that reads Storyboard.shots saw an empty
    // result (A2 Wave-1 blocker).
    const item = await ctx.db.$transaction(async (tx) => {
      const created = await tx.contentItem.create({
        data: {
          channelId,
          title,
          contentType,
          prompt: title,
          generationParams: { script: script ?? null, shots: shots ?? [] } as any,
          affiliateProductId: affiliateProductId ?? null,
          affiliateMode: affiliateMode ?? null,
          status: status ?? 'draft',
          version: 1,
        },
        include: {
          channel: { select: { id: true, name: true, primaryLanguage: true } },
        },
      });

      if (shots && shots.length > 0) {
        const totalDuration = shots.reduce((sum, s) => sum + (Number.isFinite(s.duration) ? s.duration : 0), 0);
        const storyboard = await tx.storyboard.create({
          data: {
            contentId: created.id,
            status: 'draft',
            scriptJson: { script: script ?? '', shotCount: shots.length } as any,
            totalDurationSec: totalDuration > 0 ? totalDuration : null,
          },
        });

        let cursor = 0;
        // Persist each shot sequentially so startSec/endSec are cumulative —
        // the render pipeline relies on monotonically increasing timing.
        for (let i = 0; i < shots.length; i++) {
          const shot = shots[i];
          const dur = Number.isFinite(shot.duration) && shot.duration > 0 ? shot.duration : 5;
          const startSec = cursor;
          const endSec = cursor + dur;
          cursor = endSec;
          // Build a minimal-but-valid ShotSpec. Anything beyond promptBlocks +
          // duration is resolved later by the LookDev / ShotSpec agents.
          const shotspec = {
            promptBlocks: [shot.description],
            duration: dur,
          };
          await tx.storyboardShot.create({
            data: {
              storyboardId: storyboard.id,
              shotNumber: typeof shot.id === 'number' ? shot.id : i + 1,
              shotspec: shotspec as any,
              keyframeUrls: shot.imageUrl ? [shot.imageUrl] : [],
              startSec,
              endSec,
              status: 'pending',
            },
          });
        }
      }

      return created;
    });

    return success({
      ...item,
      qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
      durationSec: item.durationSec != null ? Number(item.durationSec) : null,
      approvalGateWindowHrs: item.approvalGateWindowHrs != null ? Number(item.approvalGateWindowHrs) : null,
    });
  } catch (err) {
    logger.error('POST /api/v1/content error:', err as Error, { userId: ctx && !(ctx instanceof NextResponse) ? (ctx as ApiContext).userId : undefined });
    return error('INTERNAL_ERROR', 'Failed to create content', 500);
  }
}
