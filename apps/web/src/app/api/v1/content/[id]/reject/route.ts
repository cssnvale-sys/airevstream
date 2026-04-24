import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { updateTrustAfterAction, APPROVAL_DEFAULTS } from '@airevstream/shared';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

const RejectSchema = z.object({
  feedback: z.string().max(5000).optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;
    const authCtx = ctx as ApiContext;

    if (authCtx.role === 'viewer') {
      return forbidden('Viewers cannot reject content');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content-reject:POST:${ip}:${authCtx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    // Unconditional tenant guard (D076)
    if (!authCtx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    let body: unknown = {};
    try {
      body = await req.json();
    } catch (parseErr) {
      // Empty body is acceptable for rejection (feedback is optional)
      logger.debug('Content reject: empty or invalid request body', { parseErr });
    }
    const parsed = RejectSchema.safeParse(body);
    const feedback = parsed.success ? parsed.data.feedback : undefined;

    const rejectableStatuses = ['generated', 'pending_approval'];

    // Use interactive transaction to prevent TOCTOU race on status check
    const result = await authCtx.db.$transaction(async (tx) => {
      const item = await tx.contentItem.findFirst({
        where: {
          id,
          channel: { socialAccount: { emailAccount: { tenantId: authCtx.tenantId } } },
        },
        select: { id: true, status: true },
      });

      if (!item) return { kind: 'not_found' as const };

      if (item.status === 'draft') {
        return { kind: 'already_draft' as const };
      }
      if (!rejectableStatuses.includes(item.status)) {
        return { kind: 'invalid_state' as const, status: item.status };
      }

      const updated = await tx.contentItem.update({
        where: { id },
        data: {
          status: 'draft',
        },
      });

      await tx.actionAuditLog.create({
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
      });

      return { kind: 'rejected' as const, updated };
    });

    if (result.kind === 'not_found') {
      return notFound('Content item not found');
    }
    if (result.kind === 'already_draft') {
      return error('ALREADY_DRAFT', 'Content item is already a draft', 409);
    }
    if (result.kind === 'invalid_state') {
      return error('INVALID_STATE', `Cannot reject content with status "${result.status}"`, 409);
    }

    const updated = result.updated;

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
        const trustUpdate = updateTrustAfterAction({
          currentTrustScore: current.trustScore,
          currentGateWindowHrs: current.gateWindowHrs,
          action: 'reject',
          qualityScore: contentItem.qualityScore != null ? Number(contentItem.qualityScore) : null,
        });
        await authCtx.db.approvalTrustScore.upsert({
          where: { id: existing?.id ?? '00000000-0000-0000-0000-000000000000' },
          create: {
            dimensionType: 'content_type',
            dimensionValue: contentItem.contentType,
            trustScore: trustUpdate.newTrustScore,
            gateWindowHrs: trustUpdate.newGateWindowHrs,
            totalApproved: 0,
            totalRejected: 1,
          },
          update: {
            trustScore: trustUpdate.newTrustScore,
            gateWindowHrs: trustUpdate.newGateWindowHrs,
            totalRejected: { increment: 1 },
          },
        });
      }
    } catch (trustErr) {
      logger.error('Failed to update trust score on reject', trustErr as Error);
    }

    return success({
      ...updated,
      qualityScore: updated.qualityScore != null ? Number(updated.qualityScore) : null,
      durationSec: updated.durationSec != null ? Number(updated.durationSec) : null,
      approvalGateWindowHrs: updated.approvalGateWindowHrs != null ? Number(updated.approvalGateWindowHrs) : null,
    });
  } catch (err) {
    logger.error('POST /api/v1/content/[id]/reject error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to reject content', 500);
  }
}
