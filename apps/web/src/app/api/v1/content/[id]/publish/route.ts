import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot publish content');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content-publish:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = await params;
    if (!isUUID(id)) return error('VALIDATION_ERROR', 'Invalid ID format', 400);

    // Unconditional tenant guard (D076)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true, status: true, channelId: true },
    });

    if (!item) return notFound('Content item not found');

    if (item.status !== 'approved') {
      return error('INVALID_STATE', 'Only approved content can be published', 409);
    }

    if (!item.channelId) {
      return error('INVALID_STATE', 'Content must be assigned to a channel before publishing', 409);
    }

    const job = await addJob('content', 'content:publish', {
      contentId: id,
      channelId: item.channelId,
    });

    return success({ jobId: job.id, message: 'Publish started' });
  } catch (err) {
    logger.error('POST /api/v1/content/[id]/publish error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to publish content', 500);
  }
}
