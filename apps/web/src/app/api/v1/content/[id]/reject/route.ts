import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

const RejectSchema = z.object({
  feedback: z.string().max(5000).optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot reject content');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content-reject:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    // Unconditional tenant guard (D076)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true, status: true },
    });

    if (!item) {
      return notFound('Content item not found');
    }

    const rejectableStatuses = ['generated', 'pending_approval'];
    if (item.status === 'draft') {
      return error('ALREADY_DRAFT', 'Content item is already a draft', 409);
    }
    if (!rejectableStatuses.includes(item.status)) {
      return error('INVALID_STATE', `Cannot reject content with status "${item.status}"`, 409);
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable for rejection (feedback is optional)
    }
    const parsed = RejectSchema.safeParse(body);
    const feedback = parsed.success ? parsed.data.feedback : undefined;

    const [updated] = await ctx.db.$transaction([
      ctx.db.contentItem.update({
        where: { id },
        data: {
          status: 'draft',
        },
      }),
      ctx.db.actionAuditLog.create({
        data: {
          actionType: 'content.reject',
          tier: 1,
          parameters: {
            contentId: id,
            ...(feedback ? { feedback } : {}),
          },
          result: { previousStatus: item.status, newStatus: 'draft' },
          status: 'completed',
        },
      }),
    ]);

    return success({
      ...updated,
      qualityScore: updated.qualityScore != null ? Number(updated.qualityScore) : null,
      durationSec: updated.durationSec != null ? Number(updated.durationSec) : null,
      approvalGateWindowHrs: updated.approvalGateWindowHrs != null ? Number(updated.approvalGateWindowHrs) : null,
    });
  } catch (err) {
    console.error('POST /api/v1/content/[id]/reject error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
