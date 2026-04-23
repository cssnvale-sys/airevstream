import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { updateTrustAfterAction, APPROVAL_DEFAULTS } from '@airevstream/shared';
import { logger } from '@/lib/logger';

const RejectBodySchema = z.object({
  feedback: z.string().max(2000).optional(),
});

type RouteParams = { params: Promise<{ id: string; action: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot approve or reject content');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`approvals/[id]/[action]:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id, action } = await params;
  if (!isUUID(id)) return error('VALIDATION_ERROR', 'Invalid ID format', 400);
  if (!['approve', 'reject'].includes(action)) {
    return error('VALIDATION_ERROR', 'Action must be approve or reject', 400);
  }

  try {
    // Parse reject feedback before entering transaction
    let feedback: string | undefined;
    if (action === 'reject') {
      try {
        const body = await req.json();
        const parsed = RejectBodySchema.safeParse(body);
        if (parsed.success) {
          feedback = parsed.data.feedback;
        }
      } catch (parseErr) {
        logger.error('Failed to parse reject body', parseErr as Error);
      }
    }

    // Use interactive transaction to prevent TOCTOU race
    const result = await ctx.db.$transaction(async (tx: any) => {
      const content = await tx.contentItem.findFirst({
        where: {
          id,
          channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
        },
      });
      if (!content) return null;

      if (action === 'approve') {
        await tx.contentItem.update({
          where: { id },
          data: {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: ctx.userId,
          },
        });
      } else {
        await tx.contentItem.update({
          where: { id },
          data: { status: 'draft' },
        });
      }

      return { id, action, status: action === 'approve' ? 'approved' : 'draft', contentType: content.contentType, qualityScore: content.qualityScore };
    });

    if (!result) return error('NOT_FOUND', 'Content not found', 404);

    // Update approval trust score (non-blocking)
    try {
      const existing = await ctx.db.approvalTrustScore.findFirst({
        where: { dimensionType: 'content_type', dimensionValue: result.contentType },
      });
      const current = existing
        ? { trustScore: Number(existing.trustScore), gateWindowHrs: Number(existing.gateWindowHrs) }
        : { trustScore: 50, gateWindowHrs: APPROVAL_DEFAULTS.INITIAL_GATE_WINDOW_HRS };
      const trustUpdate = updateTrustAfterAction({
        currentTrustScore: current.trustScore,
        currentGateWindowHrs: current.gateWindowHrs,
        action: action as 'approve' | 'reject',
        qualityScore: result.qualityScore != null ? Number(result.qualityScore) : null,
      });
      await ctx.db.approvalTrustScore.upsert({
        where: { id: existing?.id ?? '00000000-0000-0000-0000-000000000000' },
        create: {
          dimensionType: 'content_type',
          dimensionValue: result.contentType,
          trustScore: trustUpdate.newTrustScore,
          gateWindowHrs: trustUpdate.newGateWindowHrs,
          totalApproved: action === 'approve' ? 1 : 0,
          totalRejected: action === 'reject' ? 1 : 0,
        },
        update: {
          trustScore: trustUpdate.newTrustScore,
          gateWindowHrs: trustUpdate.newGateWindowHrs,
          ...(action === 'approve' ? { totalApproved: { increment: 1 } } : { totalRejected: { increment: 1 } }),
        },
      });
    } catch (trustErr) {
      logger.error('Failed to update trust score', trustErr as Error);
    }

    return success({ id: result.id, action: result.action, status: result.status });
  } catch (err) {
    console.error(`POST /approvals/${id}/${action} failed:`, err);
    return error('INTERNAL_ERROR', `Failed to ${action} content`, 500);
  }
}
