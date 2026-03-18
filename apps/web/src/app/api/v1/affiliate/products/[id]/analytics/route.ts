import { authenticate, success, error, notFound } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/affiliate/products/[id]/analytics
 * Product performance analytics: clicks, conversions, revenue by channel.
 * Query: start?, end?
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const rawProduct = await ctx.db.affiliateProduct.findUnique({
      where: { id },
      select: { id: true, name: true, totalClicks: true, totalConversions: true, totalRevenue: true },
    });

    if (!rawProduct) return notFound('Affiliate product not found');

    const product = {
      ...rawProduct,
      totalRevenue: Number(rawProduct.totalRevenue),
    };

    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    const dateFilter: Record<string, unknown> = {};
    if (start) dateFilter.gte = new Date(start);
    if (end) dateFilter.lte = new Date(end);

    const clickWhere: Record<string, unknown> = { productId: id };
    if (Object.keys(dateFilter).length > 0) {
      clickWhere.createdAt = dateFilter;
    }

    // Aggregate by channel
    const byChannel = await ctx.db.affiliateClick.groupBy({
      by: ['channelId'],
      where: clickWhere,
      _count: { id: true },
      _sum: { revenue: true },
    });

    // Get channel names for the grouped results
    const channelIds = byChannel.map((c) => c.channelId).filter(Boolean) as string[];
    const channels = channelIds.length > 0
      ? await ctx.db.channel.findMany({
          where: { id: { in: channelIds } },
          select: { id: true, name: true },
        })
      : [];
    const channelMap = new Map(channels.map((c) => [c.id, c.name]));

    const channelBreakdown = byChannel.map((row) => ({
      channelId: row.channelId,
      channelName: row.channelId ? channelMap.get(row.channelId) ?? 'Unknown' : 'Direct',
      clicks: row._count.id,
      revenue: row._sum.revenue != null ? Number(row._sum.revenue) : 0,
    }));

    // Total clicks and conversions in range
    const [totalClicks, conversions] = await Promise.all([
      ctx.db.affiliateClick.count({ where: clickWhere }),
      ctx.db.affiliateClick.count({ where: { ...clickWhere, converted: true } }),
    ]);

    const totalRevenue = await ctx.db.affiliateClick.aggregate({
      where: clickWhere,
      _sum: { revenue: true },
    });

    return success({
      product,
      period: { start: start ?? null, end: end ?? null },
      summary: {
        totalClicks,
        conversions,
        conversionRate: totalClicks > 0 ? conversions / totalClicks : 0,
        totalRevenue: totalRevenue._sum.revenue != null ? Number(totalRevenue._sum.revenue) : 0,
      },
      byChannel: channelBreakdown,
    });
  } catch (err) {
    console.error('GET /api/v1/affiliate/products/[id]/analytics error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch product analytics', 500);
  }
}
