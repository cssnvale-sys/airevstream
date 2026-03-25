import { authenticate, error, paginated, parseQuery } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/system/errors
 * Recent errors (alerts with severity 'critical' or 'error' category).
 * Query: status?, limit?, page?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, params } = parseQuery(req);
    const status = params.get('status') ?? undefined;

    const validStatuses = ['open', 'acknowledged', 'resolved', 'suppressed'];

    const where: Record<string, unknown> = {
      OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
      severity: { in: ['critical', 'error'] },
    };
    if (status && validStatuses.includes(status)) where.status = status;

    const [errors, total] = await Promise.all([
      ctx.db.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      ctx.db.alert.count({ where }),
    ]);

    return paginated(errors, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/system/errors error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch errors', 500);
  }
}
