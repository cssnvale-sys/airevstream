import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const DistributeSchema = z.object({
  channelIds: z.array(z.string().uuid()).min(1).max(50),
  scheduledFor: z.string().datetime().optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;
    const authCtx = ctx as ApiContext;

    if (authCtx.role === 'viewer') {
      return forbidden('Viewers cannot distribute content');
    }

    // Unconditional tenant guard (D076)
    if (!authCtx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`distribute:${ip}:${authCtx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid content ID format');

    const body = await req.json();
    const parsed = DistributeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues.map(i => i.message).join(', '));

    const { channelIds, scheduledFor } = parsed.data;

    // Find source content and verify access
    const content = await authCtx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: authCtx.tenantId } } },
      },
      select: { id: true, status: true },
    });

    if (!content) return notFound('Content item not found');
    if (!['approved', 'posted'].includes(content.status)) {
      return error('INVALID_STATUS', 'Content must be approved to distribute', 400);
    }

    // Verify all channels belong to the tenant
    const channels = await authCtx.db.channel.findMany({
      where: {
        id: { in: channelIds },
        socialAccount: { emailAccount: { tenantId: authCtx.tenantId } },
      },
      select: { id: true, name: true, socialAccount: { select: { id: true, platform: true } } },
    });

    if (channels.length !== channelIds.length) {
      return error('INVALID_CHANNELS', 'One or more channels not found or not accessible', 400);
    }

    // Create scheduled posts for each channel
    const scheduledAt = scheduledFor ? new Date(scheduledFor) : new Date();
    const posts = await authCtx.db.$transaction(
      channels.map(channel =>
        authCtx.db.scheduledPost.create({
          data: {
            contentId: content.id,
            channelId: channel.id,
            platform: channel.socialAccount.platform,
            socialAccountId: channel.socialAccount.id,
            scheduledAt,
            status: scheduledFor ? 'scheduled' : 'pending',
          },
        }),
      ),
    );

    return success({
      distributedTo: channels.map(ch => ({ id: ch.id, name: ch.name, platform: ch.socialAccount.platform })),
      scheduledPostIds: posts.map(p => p.id),
      scheduledAt: scheduledAt.toISOString(),
      immediate: !scheduledFor,
    });
  } catch (err) {
    logger.error('POST /api/v1/content/[id]/distribute failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to distribute content', 500);
  }
}
