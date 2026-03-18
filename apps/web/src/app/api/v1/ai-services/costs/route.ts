import { authenticate, success, error, forbidden } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/ai-services/costs
 * Cost breakdown by service, provider, and timeframe.
 * Query: start?, end?, provider?, serviceType?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can view cost data');
  }

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const provider = url.searchParams.get('provider') ?? undefined;
    const serviceType = url.searchParams.get('serviceType') ?? undefined;

    const where: Record<string, unknown> = {};
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
      where.createdAt = dateFilter;
    }

    // Filter by service properties if provided
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

    // Cost by service
    const byService = await ctx.db.aiServiceUsage.groupBy({
      by: ['serviceId'],
      where,
      _sum: { cost: true, tokensUsed: true },
      _count: { id: true },
    });

    const serviceIds = byService.map((s) => s.serviceId);
    const services = serviceIds.length > 0
      ? await ctx.db.aiService.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, provider: true, serviceType: true, isLocal: true, isFree: true },
        })
      : [];
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // Total cost
    const totals = await ctx.db.aiServiceUsage.aggregate({
      where,
      _sum: { cost: true, tokensUsed: true },
      _count: { id: true },
    });

    // Group by provider (derived from service lookup)
    const providerCosts: Record<string, { cost: number; requests: number; tokens: number }> = {};
    for (const row of byService) {
      const svc = serviceMap.get(row.serviceId);
      const prov = svc?.provider ?? 'unknown';
      if (!providerCosts[prov]) {
        providerCosts[prov] = { cost: 0, requests: 0, tokens: 0 };
      }
      providerCosts[prov].cost += Number(row._sum.cost ?? 0);
      providerCosts[prov].requests += row._count.id;
      providerCosts[prov].tokens += row._sum.tokensUsed ?? 0;
    }

    return success({
      period: { start: start ?? null, end: end ?? null },
      totals: {
        totalCost: Number(totals._sum.cost ?? 0),
        totalTokens: totals._sum.tokensUsed ?? 0,
        totalRequests: totals._count.id,
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
        };
      }),
      byProvider: Object.entries(providerCosts).map(([prov, data]) => ({
        provider: prov,
        totalCost: data.cost,
        totalRequests: data.requests,
        totalTokens: data.tokens,
      })),
    });
  } catch (err) {
    console.error('GET /api/v1/ai-services/costs error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch cost breakdown', 500);
  }
}
