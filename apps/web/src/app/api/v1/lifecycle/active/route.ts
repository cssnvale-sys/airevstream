import { authenticate, success, error, paginated, parseQuery } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/lifecycle/active
 * List all active lifecycles for the tenant
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { page, limit, skip } = parseQuery(req);

  try {
    const where = {
      tenantId: ctx.tenantId,
      status: { notIn: ['completed', 'failed'] },
    };

    const [lifecycles, total] = await Promise.all([
      ctx.db.accountLifecycle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          emailAccount: { select: { id: true, email: true, status: true } },
        },
      }),
      ctx.db.accountLifecycle.count({ where }),
    ]);

    const data = lifecycles.map((lc) => ({
      id: lc.id,
      emailAccountId: lc.emailAccountId,
      email: lc.emailAccount.email,
      status: lc.status,
      targetPlatforms: lc.targetPlatforms,
      currentStep: lc.currentStep,
      discoveryResults: lc.discoveryResults,
      startedAt: lc.startedAt?.toISOString() ?? null,
      createdAt: lc.createdAt.toISOString(),
    }));

    return paginated(data, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/lifecycle/active failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list active lifecycles', 500);
  }
}
