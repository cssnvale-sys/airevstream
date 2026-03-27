import { authenticateAny, success, error, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/calendar
 * Get calendar events (scheduled posts) for a date range.
 * Query: start (ISO), end (ISO), channelId?, platform?, status?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const channelId = url.searchParams.get('channelId') ?? undefined;
    const platform = url.searchParams.get('platform') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;

    if (!start || !end) {
      return validationError('start and end query parameters are required (ISO date format)');
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return validationError('start and end must be valid ISO dates');
    }

    if (endDate <= startDate) {
      return validationError('end must be after start');
    }

    // Enforce max 90-day range to prevent unbounded queries
    const maxRangeMs = 90 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
      return validationError('Date range must not exceed 90 days');
    }

    // Validate enum params
    const validPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
    const validStatuses = ['scheduled', 'posting', 'posted', 'failed', 'cancelled'];
    if (platform && !validPlatforms.includes(platform)) {
      return validationError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
    }
    if (status && !validStatuses.includes(status)) {
      return validationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Unconditional tenant guard (D071)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const where: Record<string, unknown> = {
      scheduledAt: { gte: startDate, lte: endDate },
      // Scope to tenant via the Channel -> SocialAccount -> EmailAccount chain
      channel: {
        socialAccount: {
          emailAccount: { tenantId: ctx.tenantId },
        },
      },
    };

    if (channelId) where.channelId = channelId;
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const events = await ctx.db.scheduledPost.findMany({
      where,
      include: {
        content: {
          select: {
            id: true,
            title: true,
            contentType: true,
            status: true,
            thumbnailUrl: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            socialAccountId: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 1000,
    });

    return success(events);
  } catch (err) {
    console.error('GET /api/v1/calendar error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch calendar events', 500);
  }
}
