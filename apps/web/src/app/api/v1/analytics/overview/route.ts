import { authenticateAny, success, error } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  switch (period) {
    case '7d': return { start: new Date(now.getTime() - 7 * 86400000), end };
    case '30d': return { start: new Date(now.getTime() - 30 * 86400000), end };
    case '90d': return { start: new Date(now.getTime() - 90 * 86400000), end };
    default: return { start: new Date(0), end };
  }
}

/**
 * GET /api/v1/analytics/overview
 * Aggregated analytics overview for the dashboard.
 * Query: period (7d, 30d, 90d, all)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`analytics-overview:${ip}:${ctx.userId}`, { maxAttempts: 30, windowMs: 60 * 1000 });
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get('period') ?? '30d';
    const { start, end } = getDateRange(period);
    const dateFilter = { createdAt: { gte: start, lte: end } };

    // Tenant scoping: get this tenant's channel IDs
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map((c) => c.id);
    const channelScope = { channelId: { in: tenantChannelIds } };

    // Run all queries in parallel
    const [
      revenueAgg,
      prevRevenueAgg,
      costAgg,
      prevCostAgg,
      contentCount,
      prevContentCount,
      revenueClicks,
      channelRevenue,
      productRevenue,
      contentByStatus,
      qualityScores,
      costByService,
    ] = await Promise.all([
      // Revenue (current period)
      ctx.db.affiliateClick.aggregate({
        where: { converted: true, ...channelScope, ...dateFilter },
        _sum: { revenue: true },
      }),
      // Revenue (previous period for trend)
      ctx.db.affiliateClick.aggregate({
        where: {
          converted: true,
          ...channelScope,
          createdAt: { gte: new Date(start.getTime() - (end.getTime() - start.getTime())), lt: start },
        },
        _sum: { revenue: true },
      }),
      // AI costs (current period)
      ctx.db.aiServiceUsage.aggregate({
        where: { ...channelScope, ...dateFilter },
        _sum: { cost: true },
      }),
      // AI costs (previous period)
      ctx.db.aiServiceUsage.aggregate({
        where: {
          ...channelScope,
          createdAt: { gte: new Date(start.getTime() - (end.getTime() - start.getTime())), lt: start },
        },
        _sum: { cost: true },
      }),
      // Content count (current)
      ctx.db.contentItem.count({ where: { ...channelScope, ...dateFilter } }),
      // Content count (previous)
      ctx.db.contentItem.count({
        where: {
          ...channelScope,
          createdAt: { gte: new Date(start.getTime() - (end.getTime() - start.getTime())), lt: start },
        },
      }),
      // Revenue clicks (for daily aggregation, capped at 5000)
      ctx.db.affiliateClick.findMany({
        where: { converted: true, ...channelScope, ...dateFilter },
        select: { createdAt: true, revenue: true },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      }),
      // Revenue by channel
      ctx.db.affiliateClick.groupBy({
        by: ['channelId'],
        where: { converted: true, ...channelScope, ...dateFilter },
        _sum: { revenue: true },
        _count: { id: true },
      }),
      // Revenue by product
      ctx.db.affiliateClick.groupBy({
        by: ['productId'],
        where: { converted: true, ...channelScope, ...dateFilter },
        _sum: { revenue: true },
        _count: { id: true },
      }),
      // Content by status
      ctx.db.contentItem.groupBy({
        by: ['status'],
        where: { ...channelScope, ...dateFilter },
        _count: { id: true },
      }),
      // Quality scores (capped at 5000)
      ctx.db.contentItem.findMany({
        where: { ...channelScope, ...dateFilter, qualityScore: { not: null } },
        select: { qualityScore: true },
        take: 5000,
      }),
      // Cost by service
      ctx.db.aiServiceUsage.groupBy({
        by: ['serviceId'],
        where: { ...channelScope, ...dateFilter },
        _sum: { cost: true },
      }),
    ]);

    // Aggregate revenue by day
    const revenueByDayMap = new Map<string, number>();
    for (const click of revenueClicks) {
      const day = click.createdAt.toISOString().slice(0, 10);
      revenueByDayMap.set(day, (revenueByDayMap.get(day) ?? 0) + Number(click.revenue ?? 0));
    }
    const revenueOverTime = Array.from(revenueByDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }));

    const revenue = Number(revenueAgg._sum.revenue ?? 0);
    const prevRevenue = Number(prevRevenueAgg._sum.revenue ?? 0);
    const totalCost = Number(costAgg._sum.cost ?? 0);
    const prevCost = Number(prevCostAgg._sum.cost ?? 0);
    const profit = revenue - totalCost;
    const prevProfit = prevRevenue - prevCost;

    function trendPct(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    }

    // Resolve channel names
    const channelIds = channelRevenue.map((c) => c.channelId).filter(Boolean) as string[];
    const channels = channelIds.length > 0
      ? await ctx.db.channel.findMany({ where: { id: { in: channelIds } }, select: { id: true, name: true } })
      : [];
    const channelMap = new Map(channels.map((c) => [c.id, c.name]));

    // Resolve product names
    const productIds = productRevenue.map((p) => p.productId);
    const products = productIds.length > 0
      ? await ctx.db.affiliateProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    // Resolve service names for cost breakdown
    const serviceIds = costByService.map((s) => s.serviceId);
    const services = serviceIds.length > 0
      ? await ctx.db.aiService.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true, provider: true } })
      : [];
    const serviceMap = new Map(services.map((s) => [s.id, s.provider]));
    const modelMap = new Map(services.map((s) => [s.id, s.name]));

    // Quality score distribution
    const qualityBuckets = [
      { range: '0-20', count: 0 },
      { range: '21-40', count: 0 },
      { range: '41-60', count: 0 },
      { range: '61-80', count: 0 },
      { range: '81-100', count: 0 },
    ];
    for (const item of qualityScores) {
      const score = Number(item.qualityScore ?? 0);
      if (score <= 20) qualityBuckets[0].count++;
      else if (score <= 40) qualityBuckets[1].count++;
      else if (score <= 60) qualityBuckets[2].count++;
      else if (score <= 80) qualityBuckets[3].count++;
      else qualityBuckets[4].count++;
    }

    // Content metrics
    const statusMap = Object.fromEntries(contentByStatus.map((s) => [s.status, s._count.id]));
    const contentMetrics = [
      { label: 'Total Produced', value: contentCount },
      { label: 'Published', value: (statusMap['posted'] ?? 0) + (statusMap['approved'] ?? 0) },
      { label: 'Pending Review', value: statusMap['pending_approval'] ?? 0 },
      { label: 'In Production', value: (statusMap['generating'] ?? 0) + (statusMap['draft'] ?? 0) },
    ];

    // Aggregate cost by provider for costByService
    const costByProviderMap = new Map<string, number>();
    for (const row of costByService) {
      const provider = serviceMap.get(row.serviceId) ?? 'Unknown';
      costByProviderMap.set(provider, (costByProviderMap.get(provider) ?? 0) + Number(row._sum.cost ?? 0));
    }

    return success({
      kpis: {
        revenue,
        revenueTrend: trendPct(revenue, prevRevenue),
        totalCost,
        costTrend: trendPct(totalCost, prevCost),
        profit,
        profitTrend: trendPct(profit, prevProfit),
        contentCount,
        contentTrend: trendPct(contentCount, prevContentCount),
      },
      revenueOverTime,
      revenueByChannel: channelRevenue.map((row) => ({
        channel: row.channelId ? channelMap.get(row.channelId) ?? 'Unknown' : 'Direct',
        revenue: Number(row._sum.revenue ?? 0),
        contentCount: row._count.id,
      })),
      revenueByProduct: productRevenue.map((row) => ({
        product: productMap.get(row.productId) ?? 'Unknown',
        revenue: Number(row._sum.revenue ?? 0),
        clicks: row._count.id,
      })),
      roiByType: [],
      engagement: [],
      contentMetrics,
      qualityDistribution: qualityBuckets,
      costByService: Array.from(costByProviderMap.entries()).map(([service, cost]) => ({
        service,
        cost,
      })),
      costByModel: costByService.map((row) => ({
        service: modelMap.get(row.serviceId) ?? 'Unknown',
        cost: Number(row._sum.cost ?? 0),
      })),
      audience: [],
    });
  } catch (err) {
    console.error('GET /api/v1/analytics/overview error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch analytics overview', 500);
  }
}
