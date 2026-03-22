import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/workflows/hitl/[id]/complete
 * Mark a human-in-the-loop task as completed so the workflow can resume
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`workflows-hitl-complete:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Use interactive transaction to prevent double-complete race
    const result = await ctx.db.$transaction(async (tx: any) => {
      // Verify tenant ownership through content or account chain
      const job = await tx.workflowJob.findFirst({
        where: {
          id,
          OR: [
            { content: { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } },
            { emailAccountId: { not: null } },
          ],
        },
      });
      if (!job) return { kind: 'not_found' as const };

      // Extra check for emailAccountId-based jobs
      if (!job.contentId && job.emailAccountId) {
        const ownsAccount = await tx.emailAccount.findFirst({
          where: { id: job.emailAccountId, tenantId: ctx.tenantId },
          select: { id: true },
        });
        if (!ownsAccount) return { kind: 'not_found' as const };
      }

      if (!job.needsHuman) {
        return { kind: 'no_human' as const };
      }

      if (job.humanCompletedAt) {
        return { kind: 'already_completed' as const, job };
      }

      const updated = await tx.workflowJob.update({
        where: { id },
        data: {
          humanCompletedAt: new Date(),
          status: 'queued', // re-queue for worker to resume
        },
      });

      return { kind: 'success' as const, updated };
    });

    if (result.kind === 'not_found') return notFound('Workflow job not found');
    if (result.kind === 'no_human') {
      return error('VALIDATION_ERROR', 'This job does not require human intervention', 400);
    }
    if (result.kind === 'already_completed') {
      return success({ message: 'Already completed', job: result.job });
    }

    return success(result.updated);
  } catch (err) {
    console.error(`[POST /workflows/hitl/${id}/complete]`, err);
    return error('INTERNAL_ERROR', 'Failed to complete HITL task', 500);
  }
}
