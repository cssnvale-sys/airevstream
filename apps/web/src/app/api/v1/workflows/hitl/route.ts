import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, paginated, parseQuery } from '@/lib/api-server';

/**
 * GET /api/v1/workflows/hitl
 * List workflow jobs that need human intervention (CAPTCHA, phone verification, etc.)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { page, limit, skip } = parseQuery(req);

  try {
    // Tenant scoping: get tenant's channel and account IDs (parallel)
    const [tenantChannels, tenantAccounts] = await Promise.all([
      ctx.db.channel.findMany({
        where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
        select: { id: true },
      }),
      ctx.db.emailAccount.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true },
      }),
    ]);
    const tenantChannelIds = tenantChannels.map((c) => c.id);
    const tenantAccountIds = tenantAccounts.map((a) => a.id);

    const where = {
      needsHuman: true,
      humanCompletedAt: null,
      OR: [
        { channelId: { in: tenantChannelIds } },
        { emailAccountId: { in: tenantAccountIds } },
      ],
    };

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
