import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, paginated, parseQuery } from '@/lib/api-server';

/**
 * GET /api/v1/workflows/hitl
 * List workflow jobs that need human intervention (CAPTCHA, phone verification, etc.)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { page, limit, skip } = parseQuery(req);

  try {
    const where = { needsHuman: true, humanCompletedAt: null };

    const [jobs, total] = await Promise.all([
      ctx.db.workflowJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
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
    console.error('GET /api/v1/workflows/hitl failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list HITL tasks', 500);
  }
}
