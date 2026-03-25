import { authenticate, success, error, validationError, paginated, parseQuery, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * GET /api/v1/schedule
 * List scheduled posts with pagination, status, platform filters.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { page, limit, skip, sort, order, params } = parseQuery(req);
    const status = params.get('status') ?? undefined;
    const platform = params.get('platform') ?? undefined;
    const channelId = params.get('channelId') ?? undefined;

    const validStatuses = ['scheduled', 'posting', 'posted', 'failed', 'cancelled'];
    const validPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];

    const where: Prisma.ScheduledPostWhereInput = {};

    // Tenant scoping
    where.channel = {
      socialAccount: {
        emailAccount: { tenantId: ctx.tenantId },
      },
    };

    if (status && validStatuses.includes(status)) where.status = status;
    if (platform && validPlatforms.includes(platform)) where.platform = platform;
    if (channelId) where.channelId = channelId;

    const allowedSortFields = ['scheduledAt', 'createdAt', 'status', 'platform'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'scheduledAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      ctx.db.scheduledPost.findMany({
        where,
        include: {
          content: { select: { id: true, title: true, contentType: true, status: true } },
          channel: { select: { id: true, name: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.scheduledPost.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/schedule error:', err);
    return error('INTERNAL_ERROR', 'Failed to list scheduled posts', 500);
  }
}

const SchedulePostSchema = z.object({
  contentId: z.string().uuid(),
  channelId: z.string().uuid(),
  scheduledAt: z.string().refine((v) => !isNaN(new Date(v).getTime()), 'Must be a valid ISO date'),
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'facebook']),
  socialAccountId: z.string().uuid().optional().nullable(),
  publishConfig: z.record(z.unknown()).optional().default({}),
});

/**
 * POST /api/v1/schedule
 * Schedule content for posting.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`schedule:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = SchedulePostSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { contentId, channelId, scheduledAt, platform, socialAccountId, publishConfig } = parsed.data;

    const scheduledDate = new Date(scheduledAt);

    if (scheduledDate <= new Date()) {
      return validationError('scheduledAt must be in the future');
    }

    // Verify content and channel exist and belong to tenant
    const tenantFilter = { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } };

    const [content, channel] = await Promise.all([
      ctx.db.contentItem.findFirst({
        where: {
          id: contentId,
          channel: tenantFilter,
        },
      }),
      ctx.db.channel.findFirst({
        where: { id: channelId, ...tenantFilter },
      }),
    ]);

    if (!content) return validationError('Content not found');
    if (!channel) return validationError('Channel not found');

    // Ensure the content belongs to the specified channel (prevents cross-channel scheduling)
    if (content.channelId !== channelId) {
      return validationError('Content does not belong to the specified channel');
    }

    const post = await ctx.db.scheduledPost.create({
      data: {
        contentId,
        channelId,
        scheduledAt: scheduledDate,
        platform,
        socialAccountId: socialAccountId ?? null,
        publishConfig: (publishConfig ?? {}) as any,
        status: 'scheduled',
      },
      include: {
        content: { select: { id: true, title: true, contentType: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    return success(post);
  } catch (err) {
    console.error('POST /api/v1/schedule error:', err);
    return error('INTERNAL_ERROR', 'Failed to schedule post', 500);
  }
}
