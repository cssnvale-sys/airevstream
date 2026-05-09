import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/storyboards/[id]/approve
 * Approve a storyboard that is in pending_review status and resume the pipeline.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot approve storyboards');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`storyboard-approve:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const storyboard = await ctx.db.storyboard.findFirst({
      where: {
        id,
        content: { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } },
      },
      include: {
        content: { select: { id: true, channelId: true, contentType: true, title: true } },
        shots: { select: { id: true, status: true }, orderBy: { shotNumber: 'asc' } },
      },
    });

    if (!storyboard) return notFound('Storyboard not found');

    if (storyboard.status !== 'pending_review') {
      return error('INVALID_STATE', `Cannot approve storyboard with status "${storyboard.status}"`, 409);
    }

    // Set storyboard to approved
    await ctx.db.storyboard.update({
      where: { id },
      data: { status: 'approved' },
    });

    // Queue remaining pipeline steps (audio mix → render → final review)
    // Import queue dynamically to avoid circular deps
    try {
      const { getQueue } = await import('@airevstream/queue');
      const productionQueue = getQueue('production');

      // Queue audio mix
      await productionQueue.add('production:mix-audio', {
        tenantId: ctx.tenantId,
        contentId: storyboard.content.id,
        storyboardId: id,
        channelId: storyboard.content.channelId,
      } as any);

      // Queue video render
      await productionQueue.add('production:render-video', {
        tenantId: ctx.tenantId,
        contentId: storyboard.content.id,
        storyboardId: id,
        channelId: storyboard.content.channelId,
        qualityTier: 'cinema',
      } as any);

      // Queue final review
      const contentQueue = getQueue('content');
      await contentQueue.add('content:final-review', {
        tenantId: ctx.tenantId,
        contentId: storyboard.content.id,
        storyboardId: id,
        autoApprove: false,
      } as any);
    } catch (queueErr) {
      logger.error('Failed to queue pipeline continuation jobs', queueErr as Error);
      // Still return success — the storyboard is approved even if queuing fails
    }

    return success({ id, status: 'approved', pipelineResumed: true });
  } catch (err) {
    logger.error('POST /api/v1/storyboards/[id]/approve error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to approve storyboard', 500);
  }
}
