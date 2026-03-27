import { authenticate, success, error, notFound, isUUID, validationError } from '@/lib/api-server';
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
  if (!isUUID(id)) return validationError('Invalid ID format');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const rawProduct = await ctx.db.affiliateProduct.findUnique({
      where: { id },
      select: { id: true, name: true, totalClicks: true, totalConversions: true, totalRevenue: true },
    });

    if (!rawProduct) return notFound('Affiliate product not found');

    // Verify tenant ownership via channelPools chain
    const tenantPool = await ctx.db.channelAffiliatePool.findFirst({
      where: {
        affiliateProductId: id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { channelId: true },
    });
    if (!tenantPool) return notFound('Affiliate product not found');

    const product = {
      ...rawProduct,
      totalRevenue: Number(rawProduct.totalRevenue),
    };

    // Tenant scoping: only include clicks for channels owned by this tenant
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const channelIds = tenantChannels.map(c => c.id);

    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    const dateFilter: Record<string, unknown> = {};
    if (start) {
      const d = new Date(start);
      if (!isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (end) {
      const d = new Date(end);
      if (!isNaN(d.getTime())) dateFilter.lte = d;
    }

    const clickWhere: Record<string, unknown> = { productId: id, channelId: { in: channelIds } };
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
    const resultChannelIds = byChannel.map((c) => c.channelId).filter(Boolean) as string[];
    const channels = resultChannelIds.length > 0
      ? await ctx.db.channel.findMany({
          where: { id: { in: resultChannelIds } },
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
