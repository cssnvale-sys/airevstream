import { authenticate, error, paginated, parseQuery } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/system/alerts
 * Active alerts (filterable by severity, status, category).
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, sort, order, params } = parseQuery(req);
    const severity = params.get('severity') ?? undefined;
    const status = params.get('status') ?? undefined;
    const category = params.get('category') ?? undefined;

    const validSeverities = ['info', 'warning', 'error', 'critical'];
    const validStatuses = ['open', 'acknowledged', 'resolved', 'suppressed'];

    const where: Record<string, unknown> = {};
    // Tenant scoping: show tenant-specific + system alerts (tenantId=null)
    where.OR = [{ tenantId: ctx.tenantId }, { tenantId: null }];
    if (severity && validSeverities.includes(severity)) where.severity = severity;
    if (status && validStatuses.includes(status)) where.status = status;
    else where.status = { in: ['open', 'acknowledged'] }; // Default: show active alerts
    const validCategories = ['system', 'queue', 'ai', 'auth', 'content', 'network', 'storage'];
    if (category && validCategories.includes(category)) where.category = category;

    const allowedSorts = ['createdAt', 'severity', 'status', 'category'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [alerts, total] = await Promise.all([
      ctx.db.alert.findMany({
        where,
        select: {
          id: true,
          severity: true,
          category: true,
          title: true,
          message: true,
          source: true,
          status: true,
          acknowledgedAt: true,
          resolvedAt: true,
          createdAt: true,
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.alert.count({ where }),
    ]);

    return paginated(alerts, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/system/alerts error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch alerts', 500);
  }
}
