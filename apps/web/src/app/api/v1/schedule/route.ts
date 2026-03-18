import { authenticate, success, error, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const SchedulePostSchema = z.object({
  contentId: z.string().uuid(),
  channelId: z.string().uuid(),
  scheduledAt: z.string().refine((v) => !isNaN(new Date(v).getTime()), 'Must be a valid ISO date'),
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'facebook']),
  socialAccountId: z.string().uuid().optional().nullable(),
  publishConfig: z.record(z.unknown()).optional().default({}),
});

/**
 * POST /api/v1/schedule
 * Schedule content for posting.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = SchedulePostSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { contentId, channelId, scheduledAt, platform, socialAccountId, publishConfig } = parsed.data;

    const scheduledDate = new Date(scheduledAt);

    if (scheduledDate <= new Date()) {
      return validationError('scheduledAt must be in the future');
    }

    // Verify content and channel exist and belong to tenant
    const tenantFilter = ctx.tenantId
      ? { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } }
      : {};

    const [content, channel] = await Promise.all([
      ctx.db.contentItem.findFirst({
        where: {
          id: contentId,
          ...(ctx.tenantId ? { channel: tenantFilter } : {}),
        },
      }),
      ctx.db.channel.findFirst({
        where: { id: channelId, ...tenantFilter },
      }),
    ]);

    if (!content) return validationError('Content not found');
    if (!channel) return validationError('Channel not found');

    // Ensure the content belongs to the specified channel (prevents cross-channel scheduling)
    if (content.channelId !== channelId) {
      return validationError('Content does not belong to the specified channel');
    }

    const post = await ctx.db.scheduledPost.create({
      data: {
        contentId,
        channelId,
        scheduledAt: scheduledDate,
        platform,
        socialAccountId: socialAccountId ?? null,
        publishConfig: (publishConfig ?? {}) as any,
        status: 'scheduled',
      },
      include: {
        content: { select: { id: true, title: true, contentType: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    return success(post);
  } catch (err) {
    console.error('POST /api/v1/schedule error:', err);
    return error('INTERNAL_ERROR', 'Failed to schedule post', 500);
  }
}
