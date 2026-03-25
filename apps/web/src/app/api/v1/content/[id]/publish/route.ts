import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
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
    console.error('POST /api/v1/content/[id]/publish error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
