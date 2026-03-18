import { authenticate, error, paginated, parseQuery } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/system/workflows
 * Active workflows (paginated WorkflowJob list, filterable by status, jobType).
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, sort, order, params } = parseQuery(req);
    const status = params.get('status') ?? undefined;
    const jobType = params.get('jobType') ?? undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (jobType) where.jobType = jobType;

    const allowedSorts = ['createdAt', 'updatedAt', 'priority', 'status', 'jobType', 'progress'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [jobs, total] = await Promise.all([
      ctx.db.workflowJob.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
        include: {
          content: {
            select: { id: true, title: true, contentType: true },
          },
        },
      }),
      ctx.db.workflowJob.count({ where }),
    ]);

    return paginated(jobs, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/system/workflows error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch workflows', 500);
  }
}
