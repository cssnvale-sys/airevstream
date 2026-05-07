import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot rescore content');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content-rescore:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    // Unconditional tenant guard (D076)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return error('VALIDATION_ERROR', 'Invalid ID format', 400);

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: {
        id: true,
        status: true,
        storyboards: { select: { id: true }, take: 1 },
      },
    });

    if (!item) return notFound('Content item not found');

    if (item.status === 'draft') {
      return error('INVALID_STATE', 'Cannot rescore draft content', 409);
    }

    if (item.storyboards.length === 0) {
      return error('INVALID_STATE', 'Content must have a storyboard to rescore', 409);
    }

    const job = await addJob('content', 'content:viral-score', {
      contentId: id,
      storyboardId: item.storyboards[0].id,
    });

    return success({ jobId: job.id, message: 'Rescore started' });
  } catch (err) {
    logger.error('POST /api/v1/content/[id]/rescore error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to rescore content', 500);
  }
}
