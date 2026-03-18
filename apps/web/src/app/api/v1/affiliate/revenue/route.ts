import { authenticate, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/affiliate/revenue
 * Revenue dashboard data: totals, by channel, by product, trends.
 * Query: start?, end?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    const dateFilter: Record<string, unknown> = {};
    if (start) dateFilter.gte = new Date(start);
    if (end) dateFilter.lte = new Date(end);

    const clickWhere: Record<string, unknown> = { converted: true };
    if (Object.keys(dateFilter).length > 0) {
      clickWhere.createdAt = dateFilter;
    }

    // Total revenue
    const totals = await ctx.db.affiliateClick.aggregate({
      where: clickWhere,
      _sum: { revenue: true },
      _count: { id: true },
    });

    // Revenue by channel
    const byChannel = await ctx.db.affiliateClick.groupBy({
      by: ['channelId'],
      where: clickWhere,
      _sum: { revenue: true },
      _count: { id: true },
    });

    const channelIds = byChannel.map((c) => c.channelId).filter(Boolean) as string[];
    const channels = channelIds.length > 0
      ? await ctx.db.channel.findMany({
          where: { id: { in: channelIds } },
          select: { id: true, name: true },
        })
      : [];
    const channelMap = new Map(channels.map((c) => [c.id, c.name]));

    // Revenue by product
    const byProduct = await ctx.db.affiliateClick.groupBy({
      by: ['productId'],
      where: clickWhere,
      _sum: { revenue: true },
      _count: { id: true },
    });

    const productIds = byProduct.map((p) => p.productId);
    const products = productIds.length > 0
      ? await ctx.db.affiliateProduct.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, category: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Total clicks (including non-converted) for conversion rate
    const allClicksWhere: Record<string, unknown> = {};
    if (Object.keys(dateFilter).length > 0) {
      allClicksWhere.createdAt = dateFilter;
    }
    const totalClicks = await ctx.db.affiliateClick.count({ where: allClicksWhere });

    return success({
      period: { start: start ?? null, end: end ?? null },
      summary: {
        totalRevenue: Number(totals._sum.revenue ?? 0),
        totalConversions: totals._count.id,
        totalClicks,
        conversionRate: totalClicks > 0 ? totals._count.id / totalClicks : 0,
      },
      byChannel: byChannel.map((row) => ({
        channelId: row.channelId,
        channelName: row.channelId ? channelMap.get(row.channelId) ?? 'Unknown' : 'Direct',
        revenue: Number(row._sum.revenue ?? 0),
        conversions: row._count.id,
      })),
      byProduct: byProduct.map((row) => ({
        productId: row.productId,
        productName: productMap.get(row.productId)?.name ?? 'Unknown',
        category: productMap.get(row.productId)?.category ?? null,
        revenue: Number(row._sum.revenue ?? 0),
        conversions: row._count.id,
      })),
    });
  } catch (err) {
    console.error('GET /api/v1/affiliate/revenue error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch revenue data', 500);
  }
}
