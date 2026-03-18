import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, validationError } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/workflows/hitl/[id]/complete
 * Mark a human-in-the-loop task as completed so the workflow can resume
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify tenant ownership through content or account chain
    const job = await ctx.db.workflowJob.findFirst({
      where: {
        id,
        OR: [
          { content: { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } },
          { emailAccountId: { not: null } },
        ],
      },
    });
    if (!job) return notFound('Workflow job not found');

    // Extra check for emailAccountId-based jobs
    if (!job.contentId && job.emailAccountId) {
      const ownsAccount = await ctx.db.emailAccount.findFirst({
        where: { id: job.emailAccountId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!ownsAccount) return notFound('Workflow job not found');
    }

    if (!job.needsHuman) {
      return error('VALIDATION_ERROR', 'This job does not require human intervention', 400);
    }

    if (job.humanCompletedAt) {
      return success({ message: 'Already completed', job });
    }

    const updated = await ctx.db.workflowJob.update({
      where: { id },
      data: {
        humanCompletedAt: new Date(),
        status: 'queued', // re-queue for worker to resume
      },
    });

    return success(updated);
  } catch (err) {
    console.error(`[POST /workflows/hitl/${id}/complete]`, err);
    return error('INTERNAL_ERROR', 'Failed to complete HITL task', 500);
  }
}
