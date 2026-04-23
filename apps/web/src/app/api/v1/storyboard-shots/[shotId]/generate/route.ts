import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden } from '@/lib/api-server';
import { addJob } from '@airevstream/queue';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ shotId: string }> };

/**
 * POST /api/v1/storyboard-shots/[shotId]/generate
 * Trigger image/video generation for a specific storyboard shot.
 * Reads the shot's shotspec and queues a production:generate-image job.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const rl = checkRateLimit(`gen:shot:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many generation requests. Please try again later.', 429);
  }

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { shotId } = await params;
    if (!isUUID(shotId)) return validationError('Invalid shot ID format');

    // Load shot with tenant verification
    const shot = await ctx.db.storyboardShot.findFirst({
      where: {
        id: shotId,
        storyboard: {
          content: {
            channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
          },
        },
      },
      include: {
        storyboard: {
          select: { id: true, contentId: true },
        },
      },
    });

    if (!shot) return notFound('Shot not found');

    const shotspec = shot.shotspec as Record<string, unknown> | null;
    const prompt = (shotspec?.prompt as string) ?? (shotspec?.description as string) ?? '';

    // Mark shot as generating
    await ctx.db.storyboardShot.update({
      where: { id: shotId },
      data: { status: 'generating' },
    });

    // Queue a production job
    const job = await addJob('production', 'production:generate-image', {
      tenantId: ctx.tenantId,
      shotId,
      workflowType: 'storyboard-frame',
      params: {
        prompt,
        shotId,
        storyboardId: shot.storyboard.id,
        contentId: shot.storyboard.contentId,
      },
    });

    return success({
      shotId,
      jobId: job.id,
      status: 'generating',
      message: 'Shot generation queued',
    });
  } catch (err) {
    logger.error('[POST /storyboard-shots/[shotId]/generate]', err as Error);
    return error('INTERNAL_ERROR', 'Failed to queue shot generation', 500);
  }
}
