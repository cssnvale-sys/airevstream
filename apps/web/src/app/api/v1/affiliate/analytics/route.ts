import { authenticate, success, error, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
  channelId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  groupBy: z.enum(['product', 'channel', 'platform', 'day']).optional().default('product'),
}).strict();

/**
 * GET /api/v1/affiliate/analytics
 * Revenue analytics with flexible grouping and time periods.
 *
 * Query params:
 *   - period: 7d | 30d | 90d (default 30d)
 *   - channelId: filter by channel
 *   - productId: filter by product
 *   - groupBy: product | channel | platform | day (default product)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const url = new URL(req.url);
    const rawParams = {
      period: url.searchParams.get('period') ?? undefined,
      channelId: url.searchParams.get('channelId') ?? undefined,
      productId: url.searchParams.get('productId') ?? undefined,
      groupBy: url.searchParams.get('groupBy') ?? undefined,
    };

    const parsed = querySchema.safeParse(rawParams);
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => e.message).join('; ');
      return validationError(messages);
    }

    const { period, channelId, productId, groupBy } = parsed.data;

    // Calculate date range from period
    const now = new Date();
    const periodDays = parseInt(period.replace('d', ''), 10) || 30;
    const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // Build base where clause
    const where: Record<string, unknown> = {
      createdAt: { gte: startDate },
    };
    if (channelId) where.channelId = channelId;
    if (productId) where.productId = productId;

    // Summary totals
    const [totalClicks, conversions] = await Promise.all([
      ctx.db.affiliateClick.count({ where }),
      ctx.db.affiliateClick.aggregate({
        where: { ...where, converted: true },
        _count: { id: true },
        _sum: { revenue: true },
      }),
    ]);

    const totalConversions = conversions._count.id;
    const totalRevenue = Number(conversions._sum.revenue ?? 0);
    const conversionRate = totalClicks > 0 ? totalConversions / totalClicks : 0;

    const summary = {
      totalClicks,
      totalConversions,
      totalRevenue,
      conversionRate: Math.round(conversionRate * 10000) / 10000, // 4 decimal places
    };

    // Grouped data
    let breakdown: unknown[] = [];

    if (groupBy === 'day') {
      breakdown = await buildTimeSeriesBreakdown(ctx.db, where, startDate, now);
    } else {
      breakdown = await buildDimensionBreakdown(ctx.db, where, groupBy);
    }

    return success({
      period: { days: periodDays, start: startDate.toISOString(), end: now.toISOString() },
      summary,
      breakdown,
    });
  } catch (err) {
    console.error('GET /api/v1/affiliate/analytics error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch analytics', 500);
  }
}

/**
 * Build time-series breakdown (groupBy=day).
 * Groups clicks by calendar day and computes totals per day.
 */
async function buildTimeSeriesBreakdown(
  db: ReturnType<typeof import('@airevstream/db').getDb>,
  where: Record<string, unknown>,
  startDate: Date,
  endDate: Date,
) {
  // Get all clicks in range and aggregate per day in application logic.
  // Prisma doesn't natively group by date truncation, so we use raw query
  // or aggregate all clicks then bucket them.
  const clicks = await db.affiliateClick.findMany({
    where,
    select: {
      createdAt: true,
      converted: true,
      revenue: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Build a map of day -> aggregates
  const dayMap = new Map<string, { clicks: number; conversions: number; revenue: number }>();

  // Pre-populate all days in range
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayKey = current.toISOString().slice(0, 10);
    dayMap.set(dayKey, { clicks: 0, conversions: 0, revenue: 0 });
    current.setDate(current.getDate() + 1);
  }

  for (const click of clicks) {
    const dayKey = click.createdAt.toISOString().slice(0, 10);
    const entry = dayMap.get(dayKey);
    if (entry) {
      entry.clicks += 1;
      if (click.converted) {
        entry.conversions += 1;
        entry.revenue += Number(click.revenue ?? 0);
      }
    }
  }

  return Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    clicks: data.clicks,
    conversions: data.conversions,
    revenue: Math.round(data.revenue * 100) / 100,
    conversionRate: data.clicks > 0 ? Math.round((data.conversions / data.clicks) * 10000) / 10000 : 0,
  }));
}

/**
 * Build dimension breakdown (groupBy=product|channel|platform).
 */
async function buildDimensionBreakdown(
  db: ReturnType<typeof import('@airevstream/db').getDb>,
  where: Record<string, unknown>,
  groupBy: 'product' | 'channel' | 'platform',
) {
  const groupField = groupBy === 'product' ? 'productId'
    : groupBy === 'channel' ? 'channelId'
    : 'platform';

  // Get click and conversion counts in parallel
  const [clickGroups, conversionGroups] = await Promise.all([
    db.affiliateClick.groupBy({
      by: [groupField],
      where,
      _count: { id: true },
    }),
    db.affiliateClick.groupBy({
      by: [groupField],
      where: { ...where, converted: true },
      _count: { id: true },
      _sum: { revenue: true },
    }),
  ]);

  // Build a conversion lookup
  const conversionMap = new Map(
    conversionGroups.map((g) => [
      g[groupField],
      { conversions: g._count.id, revenue: Number(g._sum.revenue ?? 0) },
    ]),
  );

  // Resolve names for products and channels
  let nameMap = new Map<string, string>();

  if (groupBy === 'product') {
    const ids = clickGroups.map((g) => g.productId).filter(Boolean) as string[];
    if (ids.length > 0) {
      const records = await db.affiliateProduct.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      nameMap = new Map(records.map((r) => [r.id, r.name]));
    }
  } else if (groupBy === 'channel') {
    const ids = clickGroups.map((g) => g.channelId).filter(Boolean) as string[];
    if (ids.length > 0) {
      const records = await db.channel.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      nameMap = new Map(records.map((r) => [r.id, r.name]));
    }
  }

  return clickGroups.map((group) => {
    const dimensionValue = group[groupField] ?? 'unknown';
    const conv = conversionMap.get(dimensionValue) ?? { conversions: 0, revenue: 0 };
    const clicks = group._count.id;

    const entry: Record<string, unknown> = {
      [groupField]: dimensionValue,
      clicks,
      conversions: conv.conversions,
      revenue: Math.round(conv.revenue * 100) / 100,
      conversionRate: clicks > 0 ? Math.round((conv.conversions / clicks) * 10000) / 10000 : 0,
    };

    // Add resolved name if available
    if (groupBy === 'product' || groupBy === 'channel') {
      const resolvedName = typeof dimensionValue === 'string' ? nameMap.get(dimensionValue) : undefined;
      entry.name = resolvedName ?? 'Unknown';
    }

    return entry;
  });
}
