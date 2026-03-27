import { authenticateAny, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/analytics/content-performance
 * Content performance: quality scores, status counts, model usage.
 * Query: channelId?, start?, end?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channelId') ?? undefined;
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    // Tenant scoping: get this tenant's channel IDs
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map((c) => c.id);

    const where: Record<string, unknown> = {
      channelId: channelId && tenantChannelIds.includes(channelId)
        ? channelId
        : { in: tenantChannelIds },
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

    // Status breakdown
    const byStatus = await ctx.db.contentItem.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    // Content type breakdown
    const byType = await ctx.db.contentItem.groupBy({
      by: ['contentType'],
      where,
      _count: { id: true },
      _avg: { qualityScore: true },
    });

    // Average quality score
    const qualityStats = await ctx.db.contentItem.aggregate({
      where: { ...where, qualityScore: { not: null } },
      _avg: { qualityScore: true },
      _min: { qualityScore: true },
      _max: { qualityScore: true },
      _count: { qualityScore: true },
    });

    // AI model usage (which models generated content)
    const byModel = await ctx.db.contentItem.groupBy({
      by: ['aiServiceId'],
      where: { ...where, aiServiceId: { not: null } },
      _count: { id: true },
      _avg: { qualityScore: true },
    });

    const serviceIds = byModel.map((m) => m.aiServiceId).filter(Boolean) as string[];
    const services = serviceIds.length > 0
      ? await ctx.db.aiService.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, provider: true, serviceType: true },
        })
      : [];
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // Total content count
    const totalContent = await ctx.db.contentItem.count({ where });

    return success({
      period: { start: start ?? null, end: end ?? null },
      summary: {
        totalContent,
        qualityScore: {
          average: qualityStats._avg.qualityScore != null ? Number(qualityStats._avg.qualityScore) : null,
          min: qualityStats._min.qualityScore != null ? Number(qualityStats._min.qualityScore) : null,
          max: qualityStats._max.qualityScore != null ? Number(qualityStats._max.qualityScore) : null,
          scoredCount: qualityStats._count.qualityScore,
        },
      },
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count.id,
      })),
      byContentType: byType.map((row) => ({
        contentType: row.contentType,
        count: row._count.id,
        avgQualityScore: row._avg.qualityScore != null ? Number(row._avg.qualityScore) : null,
      })),
      byModel: byModel.map((row) => {
        const svc = row.aiServiceId ? serviceMap.get(row.aiServiceId) : null;
        return {
          serviceId: row.aiServiceId,
          serviceName: svc?.name ?? 'Unknown',
          provider: svc?.provider ?? 'Unknown',
          count: row._count.id,
          avgQualityScore: row._avg.qualityScore != null ? Number(row._avg.qualityScore) : null,
        };
      }),
    });
  } catch (err) {
    console.error('GET /api/v1/analytics/content-performance error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch content performance', 500);
  }
}
