import { authenticate, success, error, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/ai-services/usage
 * Usage analytics grouped by provider, serviceType, date range.
 * Query: start?, end?, serviceId?, groupBy? (provider|serviceType|requestType)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can view usage analytics');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`ai-services-usage:${ip}:${ctx.userId}`, RATE_LIMITS.standardRead);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const serviceId = url.searchParams.get('serviceId') ?? undefined;

    const where: Record<string, unknown> = {};
    if (serviceId) where.serviceId = serviceId;

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

    // Aggregate by service
    const byService = await ctx.db.aiServiceUsage.groupBy({
      by: ['serviceId'],
      where,
      _count: { id: true },
      _sum: { tokensUsed: true, cost: true },
      _avg: { responseMs: true },
    });

    // Get service details for the grouped results
    const serviceIds = byService.map((s) => s.serviceId);
    const services = serviceIds.length > 0
      ? await ctx.db.aiService.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, provider: true, serviceType: true },
        })
      : [];
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // Aggregate by request type
    const byRequestType = await ctx.db.aiServiceUsage.groupBy({
      by: ['requestType'],
      where,
      _count: { id: true },
      _sum: { tokensUsed: true, cost: true },
      _avg: { responseMs: true },
    });

    // Overall totals
    const totals = await ctx.db.aiServiceUsage.aggregate({
      where,
      _count: { id: true },
      _sum: { tokensUsed: true, cost: true },
      _avg: { responseMs: true, qualityScore: true },
    });

    // Success rate
    const successCount = await ctx.db.aiServiceUsage.count({
      where: { ...where, success: true },
    });

    return success({
      period: { start: start ?? null, end: end ?? null },
      totals: {
        requests: totals._count.id,
        tokensUsed: totals._sum.tokensUsed ?? 0,
        totalCost: Number(totals._sum.cost ?? 0),
        avgResponseMs: totals._avg.responseMs ?? 0,
        avgQualityScore: totals._avg.qualityScore != null ? Number(totals._avg.qualityScore) : null,
        successRate: totals._count.id > 0 ? successCount / totals._count.id : 1,
      },
      byService: byService.map((row) => ({
        serviceId: row.serviceId,
        serviceName: serviceMap.get(row.serviceId)?.name ?? 'Unknown',
        provider: serviceMap.get(row.serviceId)?.provider ?? 'Unknown',
        serviceType: serviceMap.get(row.serviceId)?.serviceType ?? 'Unknown',
        requests: row._count.id,
        tokensUsed: row._sum.tokensUsed ?? 0,
        totalCost: Number(row._sum.cost ?? 0),
        avgResponseMs: row._avg.responseMs ?? 0,
      })),
      byRequestType: byRequestType.map((row) => ({
        requestType: row.requestType ?? 'unknown',
        requests: row._count.id,
        tokensUsed: row._sum.tokensUsed ?? 0,
        totalCost: Number(row._sum.cost ?? 0),
        avgResponseMs: row._avg.responseMs ?? 0,
      })),
    });
  } catch (err) {
    console.error('GET /api/v1/ai-services/usage error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch usage analytics', 500);
  }
}
