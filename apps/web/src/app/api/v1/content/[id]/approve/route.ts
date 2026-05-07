import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { updateTrustAfterAction, APPROVAL_DEFAULTS } from '@airevstream/shared';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;
    const authCtx = ctx as ApiContext;

    if (authCtx.role === 'viewer') {
      return forbidden('Viewers cannot approve content');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content-approve:POST:${ip}:${authCtx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    // Unconditional tenant guard (D076)
    if (!authCtx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const approvableStatuses = ['generated', 'pending_approval'];

    const updated = await authCtx.db.$transaction(async (tx) => {
      const item = await tx.contentItem.findFirst({
        where: {
          id,
          channel: { socialAccount: { emailAccount: { tenantId: authCtx.tenantId } } },
        },
        select: { id: true, status: true },
      });

      if (!item) return null;

      if (item.status === 'approved') return 'already_approved' as const;
      if (!approvableStatuses.includes(item.status)) return item.status;

      const result = await tx.contentItem.update({
        where: { id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: authCtx.userId,
        },
      });

      await tx.actionAuditLog.create({
        data: {
          actionType: 'content.approve',
          tier: 1,
          parameters: { contentId: id },
          result: { status: 'approved' },
          status: 'completed',
        },
      });

      return result;
    });

    if (updated === null) {
      return notFound('Content item not found');
    }
    if (updated === 'already_approved') {
      return error('ALREADY_APPROVED', 'Content item is already approved', 409);
    }
    if (typeof updated === 'string') {
      return error('INVALID_STATE', `Cannot approve content with status "${updated}"`, 409);
    }

    // Update approval trust score (non-blocking)
    try {
      const contentItem = await authCtx.db.contentItem.findUnique({
        where: { id },
        select: { contentType: true, qualityScore: true },
      });
      if (contentItem) {
        const existing = await authCtx.db.approvalTrustScore.findFirst({
          where: { dimensionType: 'content_type', dimensionValue: contentItem.contentType },
        });
        const current = existing
          ? { trustScore: Number(existing.trustScore), gateWindowHrs: Number(existing.gateWindowHrs) }
          : { trustScore: 50, gateWindowHrs: APPROVAL_DEFAULTS.INITIAL_GATE_WINDOW_HRS };
        const updated = updateTrustAfterAction({
          currentTrustScore: current.trustScore,
          currentGateWindowHrs: current.gateWindowHrs,
          action: 'approve',
          qualityScore: contentItem.qualityScore != null ? Number(contentItem.qualityScore) : null,
        });
        await authCtx.db.approvalTrustScore.upsert({
          where: { id: existing?.id ?? '00000000-0000-0000-0000-000000000000' },
          create: {
            dimensionType: 'content_type',
            dimensionValue: contentItem.contentType,
            trustScore: updated.newTrustScore,
            gateWindowHrs: updated.newGateWindowHrs,
            totalApproved: 1,
            totalRejected: 0,
          },
          update: {
            trustScore: updated.newTrustScore,
            gateWindowHrs: updated.newGateWindowHrs,
            totalApproved: { increment: 1 },
          },
        });
      }
    } catch (trustErr) {
      logger.error('Failed to update trust score on approve', trustErr as Error);
    }

    return success({
      ...updated,
      qualityScore: updated.qualityScore != null ? Number(updated.qualityScore) : null,
      durationSec: updated.durationSec != null ? Number(updated.durationSec) : null,
      approvalGateWindowHrs: updated.approvalGateWindowHrs != null ? Number(updated.approvalGateWindowHrs) : null,
    });
  } catch (err) {
    logger.error('POST /api/v1/content/[id]/approve error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to approve content', 500);
  }
}
