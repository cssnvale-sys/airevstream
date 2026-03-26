import { authenticateAny, success, error, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/analytics/export
 * Export analytics report as JSON.
 * Query: type (revenue|engagement|content|costs|audience), format? (json), start?, end?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const rl = checkRateLimit(`analytics:export:${ctx.userId}`, RATE_LIMITS.analyticsExport);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many export requests. Please try again later.', 429);
  }

  try {
    const url = new URL(req.url);
    const reportType = url.searchParams.get('type');
    const format = url.searchParams.get('format') ?? 'json';
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if (!reportType) {
      return validationError('type query parameter is required (revenue|engagement|content|costs|audience)');
    }

    const validTypes = ['revenue', 'engagement', 'content', 'costs', 'audience'];
    if (!validTypes.includes(reportType)) {
      return validationError(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const dateFilter: Record<string, unknown> = {};
    if (start) {
      const d = new Date(start);
      if (!isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (end) {
      const d = new Date(end);
      if (!isNaN(d.getTime())) dateFilter.lte = d;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Tenant scoping: get this tenant's channel IDs
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map((c) => c.id);

    let reportData: unknown;

    switch (reportType) {
      case 'revenue': {
        const where: Record<string, unknown> = { converted: true, channelId: { in: tenantChannelIds } };
        if (hasDateFilter) where.createdAt = dateFilter;

        const clicks = await ctx.db.affiliateClick.findMany({
          where,
          include: {
            product: { select: { id: true, name: true, category: true } },
            channel: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const totals = await ctx.db.affiliateClick.aggregate({
          where,
          _sum: { revenue: true },
          _count: { id: true },
        });

        reportData = {
          summary: { totalRevenue: Number(totals._sum.revenue ?? 0), totalConversions: totals._count.id },
          records: clicks.map(c => ({ ...c, revenue: c.revenue != null ? Number(c.revenue) : null })),
        };
        break;
      }

      case 'engagement': {
        const where: Record<string, unknown> = { status: 'posted', channelId: { in: tenantChannelIds } };
        if (hasDateFilter) where.createdAt = dateFilter;

        const items = await ctx.db.contentItem.findMany({
          where,
          select: {
            id: true,
            title: true,
            contentType: true,
            performance: true,
            channelId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        reportData = { totalItems: items.length, records: items };
        break;
      }

      case 'content': {
        const where: Record<string, unknown> = { channelId: { in: tenantChannelIds } };
        if (hasDateFilter) where.createdAt = dateFilter;

        const byStatus = await ctx.db.contentItem.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
        });

        const byType = await ctx.db.contentItem.groupBy({
          by: ['contentType'],
          where,
          _count: { id: true },
          _avg: { qualityScore: true },
        });

        reportData = {
          byStatus,
          byType: byType.map(t => ({
            ...t,
            _avg: { qualityScore: t._avg.qualityScore != null ? Number(t._avg.qualityScore) : null },
          })),
        };
        break;
      }

      case 'costs': {
        const where: Record<string, unknown> = { channelId: { in: tenantChannelIds } };
        if (hasDateFilter) where.createdAt = dateFilter;

        const usage = await ctx.db.aiServiceUsage.findMany({
          where,
          include: {
            service: { select: { id: true, name: true, provider: true, serviceType: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const totals = await ctx.db.aiServiceUsage.aggregate({
          where,
          _sum: { cost: true, tokensUsed: true },
          _count: { id: true },
        });

        reportData = {
          summary: {
            totalCost: Number(totals._sum.cost ?? 0),
            totalTokens: totals._sum.tokensUsed ?? 0,
            totalRequests: totals._count.id,
          },
          records: usage.map(u => ({
            ...u,
            cost: u.cost != null ? Number(u.cost) : null,
            durationSec: u.durationSec != null ? Number(u.durationSec) : null,
            qualityScore: u.qualityScore != null ? Number(u.qualityScore) : null,
          })),
        };
        break;
      }

      case 'audience': {
        const channels = await ctx.db.channel.findMany({
          where: { status: 'active', socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
          select: {
            id: true,
            name: true,
            primaryLanguage: true,
            niches: true,
            platformMetadata: true,
            socialAccount: {
              select: { platform: true, username: true, metadata: true },
            },
          },
        });

        reportData = { totalChannels: channels.length, channels };
        break;
      }
    }

    const exportPayload = {
      reportType,
      format,
      generatedAt: new Date().toISOString(),
      period: { start: start ?? null, end: end ?? null },
      data: reportData,
    };

    if (format === 'json') {
      return new NextResponse(JSON.stringify(exportPayload, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="report-${reportType}-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    return success(exportPayload);
  } catch (err) {
    console.error('GET /api/v1/analytics/export error:', err);
    return error('INTERNAL_ERROR', 'Failed to export analytics', 500);
  }
}
