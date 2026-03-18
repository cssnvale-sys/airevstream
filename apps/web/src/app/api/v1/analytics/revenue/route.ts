import { authenticate, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/analytics/revenue
 * Revenue data: sum of affiliate click conversion values, groupable by channel, product, period.
 * Query: start?, end?, channelId?, productId?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const channelId = url.searchParams.get('channelId') ?? undefined;
    const productId = url.searchParams.get('productId') ?? undefined;

    const where: Record<string, unknown> = { converted: true };
    if (channelId) where.channelId = channelId;
    if (productId) where.productId = productId;
    if (start || end) {
      const dateFilter: Record<string, unknown> = {};
      if (start) dateFilter.gte = new Date(start);
      if (end) dateFilter.lte = new Date(end);
      where.createdAt = dateFilter;
    }

    // Total revenue
    const totals = await ctx.db.affiliateClick.aggregate({
      where,
      _sum: { revenue: true },
      _count: { id: true },
    });

    // Revenue by channel
    const byChannel = await ctx.db.affiliateClick.groupBy({
      by: ['channelId'],
      where,
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
      where,
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

    return success({
      period: { start: start ?? null, end: end ?? null },
      totals: {
        totalRevenue: totals._sum.revenue ?? 0,
        totalConversions: totals._count.id,
      },
      byChannel: byChannel.map((row) => ({
        channelId: row.channelId,
        channelName: row.channelId ? channelMap.get(row.channelId) ?? 'Unknown' : 'Direct',
        revenue: row._sum.revenue ?? 0,
        conversions: row._count.id,
      })),
      byProduct: byProduct.map((row) => ({
        productId: row.productId,
        productName: productMap.get(row.productId)?.name ?? 'Unknown',
        category: productMap.get(row.productId)?.category ?? null,
        revenue: row._sum.revenue ?? 0,
        conversions: row._count.id,
      })),
    });
  } catch (err) {
    console.error('GET /api/v1/analytics/revenue error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch revenue analytics', 500);
  }
}
