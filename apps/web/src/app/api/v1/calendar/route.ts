import { authenticateAny, success, error, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

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

    const where: Record<string, unknown> = {
      scheduledAt: { gte: startDate, lte: endDate },
      // Scope to tenant via the Channel -> SocialAccount -> EmailAccount chain
      ...(ctx.tenantId
        ? {
            channel: {
              socialAccount: {
                emailAccount: { tenantId: ctx.tenantId },
              },
            },
          }
        : {}),
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
    });

    return success(events);
  } catch (err) {
    console.error('GET /api/v1/calendar error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch calendar events', 500);
  }
}
