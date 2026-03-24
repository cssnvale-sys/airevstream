import { authenticate, error, paginated, parseQuery } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/workflows
 * List workflow jobs with filters.
 * Query: status?, jobType?, page, limit
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, sort, order, params } = parseQuery(req);
    const status = params.get('status') ?? undefined;
    const jobType = params.get('jobType') ?? undefined;

    // Tenant scoping: get tenant's channel and account IDs
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map((c) => c.id);
    const tenantAccounts = await ctx.db.emailAccount.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true },
    });
    const tenantAccountIds = tenantAccounts.map((a) => a.id);

    const orConditions: Record<string, unknown>[] = [
      { channelId: { in: tenantChannelIds } },
      { emailAccountId: { in: tenantAccountIds } },
    ];
    // Only show unscoped system jobs to admins (prevent cross-tenant data leak)
    if (ctx.role === 'admin') {
      orConditions.push({ channelId: null, emailAccountId: null });
    }
    const where: Record<string, unknown> = { OR: orConditions };
    if (status) where.status = status;
    if (jobType) where.jobType = jobType;

    const allowedSorts = ['createdAt', 'updatedAt', 'status', 'priority', 'progress'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      ctx.db.workflowJob.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.workflowJob.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/workflows error:', err);
    return error('INTERNAL_ERROR', 'Failed to list workflow jobs', 500);
  }
}
