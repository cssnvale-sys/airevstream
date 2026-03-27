import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const BulkApprovalSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['approve', 'reject']),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`approvals-bulk:POST:${ip}:${ctx.userId}`, RATE_LIMITS.bulkOperation);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const body = await req.json();
    const parsed = BulkApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { ids, action } = parsed.data;

    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    // Verify all content items exist and belong to tenant
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map(c => c.id);

    const items = await ctx.db.contentItem.findMany({
      where: { id: { in: ids }, channelId: { in: tenantChannelIds } },
      select: { id: true, status: true },
    });

    if (items.length !== ids.length) {
      const foundIds = new Set(items.map((i) => i.id));
      const missingIds = ids.filter((id) => !foundIds.has(id));
      return error('NOT_FOUND', `Content items not found: ${missingIds.join(', ')}`, 404);
    }

    const now = new Date();
    const results: { id: string; status: string }[] = [];

    if (action === 'approve') {
      await ctx.db.$transaction([
        ctx.db.contentItem.updateMany({
          where: { id: { in: ids } },
          data: {
            status: 'approved',
            approvedAt: now,
            approvedBy: ctx.userId,
          },
        }),
        ctx.db.actionAuditLog.createMany({
          data: ids.map((contentId) => ({
            actionType: 'content.bulk_approve',
            tier: 1,
            parameters: { contentId },
            result: { status: 'approved' },
            status: 'completed',
          })),
        }),
      ]);

      for (const id of ids) {
        results.push({ id, status: 'approved' });
      }
    } else {
      await ctx.db.$transaction([
        ctx.db.contentItem.updateMany({
          where: { id: { in: ids } },
          data: {
            status: 'draft',
          },
        }),
        ctx.db.actionAuditLog.createMany({
          data: ids.map((contentId) => ({
            actionType: 'content.bulk_reject',
            tier: 1,
            parameters: { contentId },
            result: { previousStatus: 'pending_approval', newStatus: 'draft' },
            status: 'completed',
          })),
        }),
      ]);

      for (const id of ids) {
        results.push({ id, status: 'draft' });
      }
    }

    return success({
      action,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error('POST /api/v1/approvals/bulk error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
