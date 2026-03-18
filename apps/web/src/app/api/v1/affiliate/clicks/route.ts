import { authenticate, success, error, paginated, parseQuery } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/affiliate/clicks
 * Click analytics filterable by product, channel, date range.
 * Query: productId?, channelId?, start?, end?, converted?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, params } = parseQuery(req);
    const productId = params.get('productId') ?? undefined;
    const channelId = params.get('channelId') ?? undefined;
    const start = params.get('start');
    const end = params.get('end');
    const converted = params.get('converted');

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (channelId) where.channelId = channelId;
    if (converted === 'true') where.converted = true;
    if (converted === 'false') where.converted = false;

    if (start || end) {
      const dateFilter: Record<string, unknown> = {};
      if (start) dateFilter.gte = new Date(start);
      if (end) dateFilter.lte = new Date(end);
      where.createdAt = dateFilter;
    }

    const [clicks, total] = await Promise.all([
      ctx.db.affiliateClick.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, category: true } },
          channel: { select: { id: true, name: true } },
          content: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      ctx.db.affiliateClick.count({ where }),
    ]);

    return paginated(clicks, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/affiliate/clicks error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch click analytics', 500);
  }
}
