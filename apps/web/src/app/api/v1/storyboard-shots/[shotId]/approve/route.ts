import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden, formatZodErrors , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ shotId: string  }> };

const ShotActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'regenerate']),
});

/**
 * POST /api/v1/storyboard-shots/[shotId]/approve
 * Approve, reject, or regenerate an individual shot.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot modify shots');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`shot-approve:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { shotId } = await params;
    if (!isUUID(shotId)) return validationError('Invalid shot ID format');

    const body = await req.json();
    const parsed = ShotActionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { action } = parsed.data;

    // Verify the shot belongs to the tenant
    const shot = await ctx.db.storyboardShot.findFirst({
      where: {
        id: shotId,
        storyboard: { content: { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } },
      },
      include: {
        storyboard: {
          include: {
            content: { select: { id: true, channelId: true } },
          },
        },
      },
    });

    if (!shot) return notFound('Shot not found');

    if (action === 'approve') {
      await ctx.db.storyboardShot.update({
        where: { id: shotId },
        data: { status: 'approved' },
      });
    } else if (action === 'reject') {
      await ctx.db.storyboardShot.update({
        where: { id: shotId },
        data: { status: 'failed' },
      });
    } else if (action === 'regenerate') {
      // Increment seed and set to pending for regeneration
      const spec = (shot.shotspec as Record<string, unknown>) ?? {};
      const currentSeed = (spec.seed as number) ?? Math.floor(Math.random() * 2147483647);
      await ctx.db.storyboardShot.update({
        where: { id: shotId },
        data: {
          status: 'pending',
          shotspec: { ...spec, seed: currentSeed + 1 } as Prisma.InputJsonValue,
        },
      });

      // Queue shot generation
      try {
        const { getQueue } = await import('@airevstream/queue');
        const productionQueue = getQueue('production');
        await productionQueue.add('production:generate-shots', {
          tenantId: ctx.tenantId,
          contentId: shot.storyboard.content.id,
          storyboardId: shot.storyboard.id,
          shotIds: [shotId],
          channelId: shot.storyboard.content.channelId,
        } as any);
      } catch (queueErr) {
        logger.error('Failed to queue shot regeneration', queueErr as Error);
      }
    }

    return success({ shotId, action, status: action === 'approve' ? 'approved' : action === 'reject' ? 'failed' : 'pending' });
  } catch (err) {
    logger.error('POST /api/v1/storyboard-shots/[shotId]/approve error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to approve shot', 500);
  }
}
