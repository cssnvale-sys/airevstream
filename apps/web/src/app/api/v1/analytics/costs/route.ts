import { authenticateAny, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/analytics/costs
 * Cost analysis: AiServiceUsage aggregated by service, type.
 * Query: start?, end?, provider?, serviceType?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const provider = url.searchParams.get('provider') ?? undefined;
    const serviceType = url.searchParams.get('serviceType') ?? undefined;

    // Tenant scoping: get this tenant's channel IDs
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map((c) => c.id);

    const where: Record<string, unknown> = {
      channelId: { in: tenantChannelIds },
    };
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

    // Filter by service attributes
    if (provider || serviceType) {
      const serviceWhere: Record<string, unknown> = {};
      if (provider) serviceWhere.provider = provider;
      if (serviceType) serviceWhere.serviceType = serviceType;
      const matchingServices = await ctx.db.aiService.findMany({
        where: serviceWhere,
        select: { id: true },
      });
      where.serviceId = { in: matchingServices.map((s) => s.id) };
    }

    // Total costs
    const totals = await ctx.db.aiServiceUsage.aggregate({
      where,
      _sum: { cost: true, tokensUsed: true },
      _count: { id: true },
      _avg: { cost: true, responseMs: true },
    });

    // By service
    const byService = await ctx.db.aiServiceUsage.groupBy({
      by: ['serviceId'],
      where,
      _sum: { cost: true, tokensUsed: true },
      _count: { id: true },
      _avg: { cost: true },
    });

    const serviceIds = byService.map((s) => s.serviceId);
    const services = serviceIds.length > 0
      ? await ctx.db.aiService.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, provider: true, serviceType: true, isLocal: true, isFree: true },
        })
      : [];
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // By request type
    const byRequestType = await ctx.db.aiServiceUsage.groupBy({
      by: ['requestType'],
      where,
      _sum: { cost: true, tokensUsed: true },
      _count: { id: true },
    });

    return success({
      period: { start: start ?? null, end: end ?? null },
      totals: {
        totalCost: Number(totals._sum.cost ?? 0),
        totalTokens: totals._sum.tokensUsed ?? 0,
        totalRequests: totals._count.id,
        avgCostPerRequest: Number(totals._avg.cost ?? 0),
        avgResponseMs: totals._avg.responseMs ?? 0,
      },
      byService: byService.map((row) => {
        const svc = serviceMap.get(row.serviceId);
        return {
          serviceId: row.serviceId,
          serviceName: svc?.name ?? 'Unknown',
          provider: svc?.provider ?? 'Unknown',
          serviceType: svc?.serviceType ?? 'Unknown',
          isLocal: svc?.isLocal ?? false,
          isFree: svc?.isFree ?? false,
          totalCost: Number(row._sum.cost ?? 0),
          tokensUsed: row._sum.tokensUsed ?? 0,
          requests: row._count.id,
          avgCostPerRequest: Number(row._avg.cost ?? 0),
        };
      }),
      byRequestType: byRequestType.map((row) => ({
        requestType: row.requestType ?? 'unknown',
        totalCost: Number(row._sum.cost ?? 0),
        tokensUsed: row._sum.tokensUsed ?? 0,
        requests: row._count.id,
      })),
    });
  } catch (err) {
    console.error('GET /api/v1/analytics/costs error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch cost analytics', 500);
  }
}
