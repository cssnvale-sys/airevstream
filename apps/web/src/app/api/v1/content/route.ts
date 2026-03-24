import { NextRequest, NextResponse } from 'next/server';
import { authenticate, authenticateAny, success, error, paginated, parseQuery, validationError, forbidden } from '@/lib/api-server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticateAny(req, 'read');
    if (ctx instanceof NextResponse) return ctx;

    const { page, limit, skip, sort, order, search, params } = parseQuery(req);

    const status = params.get('status') ?? undefined;
    const contentType = params.get('contentType') ?? undefined;
    const channelId = params.get('channelId') ?? undefined;
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
    console.error('GET /api/v1/content error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
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
}).strict();

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
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
      return validationError(parsed.error.errors.map(e => e.message).join(', '));
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

    const item = await ctx.db.contentItem.create({
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

    return success({
      ...item,
      qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
      durationSec: item.durationSec != null ? Number(item.durationSec) : null,
      approvalGateWindowHrs: item.approvalGateWindowHrs != null ? Number(item.approvalGateWindowHrs) : null,
    });
  } catch (err) {
    console.error('POST /api/v1/content error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
