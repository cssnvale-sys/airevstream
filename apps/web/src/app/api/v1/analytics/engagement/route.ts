import { authenticateAny, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/analytics/engagement
 * Engagement metrics from content performance JSONB data.
 * Query: channelId?, contentType?, start?, end?, limit?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channelId') ?? undefined;
    const contentType = url.searchParams.get('contentType') ?? undefined;
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const parsedLimit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const resultLimit = Math.min(100, Math.max(1, isNaN(parsedLimit) ? 20 : parsedLimit));

    // Tenant scoping: get this tenant's channel IDs
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map((c) => c.id);

    const where: Record<string, unknown> = {
      status: 'posted',
      channelId: channelId && tenantChannelIds.includes(channelId)
        ? channelId
        : { in: tenantChannelIds },
    };
    if (contentType) where.contentType = contentType;
    if (start || end) {
      const dateFilter: Record<string, unknown> = {};
      if (start) {
        const d = new Date(start);
        if (!isNaN(d.getTime())) dateFilter.gte = d;
      }
      if (end) {
        const d = new Date(end);
        if (!isNaN(d.getTime())) dateFilter.lte = d;
      }
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    }

    // Get posted content with performance data
    const contentItems = await ctx.db.contentItem.findMany({
      where,
      select: {
        id: true,
        title: true,
        contentType: true,
        performance: true,
        channelId: true,
        createdAt: true,
        channel: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: resultLimit,
    });

    // Content counts by type for posted items
    const byContentType = await ctx.db.contentItem.groupBy({
      by: ['contentType'],
      where,
      _count: { id: true },
    });

    // Total posted content
    const totalPosted = await ctx.db.contentItem.count({ where });

    return success({
      period: { start: start ?? null, end: end ?? null },
      summary: {
        totalPosted,
        byContentType: byContentType.map((row) => ({
          contentType: row.contentType,
          count: row._count.id,
        })),
      },
      items: contentItems,
    });
  } catch (err) {
    console.error('GET /api/v1/analytics/engagement error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch engagement analytics', 500);
  }
}
