import { authenticate, success, error, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/schedule
 * Schedule content for posting.
 * Body: { contentId, channelId, scheduledAt, platform, socialAccountId?, publishConfig? }
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const { contentId, channelId, scheduledAt, platform, socialAccountId, publishConfig } = body;

    if (!contentId || !channelId || !scheduledAt || !platform) {
      return validationError('contentId, channelId, scheduledAt, and platform are required');
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return validationError('scheduledAt must be a valid ISO date');
    }

    if (scheduledDate <= new Date()) {
      return validationError('scheduledAt must be in the future');
    }

    const validPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
    if (!validPlatforms.includes(platform)) {
      return validationError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
    }

    // Verify content exists and belongs to the requested channel
    const [content, channel] = await Promise.all([
      ctx.db.contentItem.findUnique({ where: { id: contentId } }),
      ctx.db.channel.findUnique({ where: { id: channelId } }),
    ]);

    if (!content) return validationError('Content not found');
    if (!channel) return validationError('Channel not found');

    // Ensure the content belongs to the specified channel (prevents cross-channel scheduling)
    if (content.channelId !== channelId) {
      return validationError('Content does not belong to the specified channel');
    }

    // Verify the channel belongs to the authenticated user's tenant (if tenant-scoped)
    if (ctx.tenantId) {
      const channelWithTenant = await ctx.db.channel.findFirst({
        where: {
          id: channelId,
          socialAccount: {
            emailAccount: { tenantId: ctx.tenantId },
          },
        },
      });
      if (!channelWithTenant) {
        return error('FORBIDDEN', 'Channel does not belong to your tenant', 403);
      }
    }

    const post = await ctx.db.scheduledPost.create({
      data: {
        contentId,
        channelId,
        scheduledAt: scheduledDate,
        platform,
        socialAccountId: socialAccountId ?? null,
        publishConfig: publishConfig ?? {},
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
