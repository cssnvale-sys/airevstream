import { authenticateAny, success, error } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/analytics/audience
 * Audience insights: channel subscriber/follower counts from platform metadata.
 * Query: channelId?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`analytics-audience:${ip}:${ctx.userId}`, { maxAttempts: 30, windowMs: 60 * 1000 });
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channelId') ?? undefined;

    // Tenant scoping through socialAccount → emailAccount chain
    const where: Record<string, unknown> = {
      status: 'active',
      socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
    };
    if (channelId) where.id = channelId;

    const channels = await ctx.db.channel.findMany({
      where,
      select: {
        id: true,
        name: true,
        primaryLanguage: true,
        niches: true,
        platformMetadata: true,
        healthScore: true,
        socialAccount: {
          select: {
            platform: true,
            username: true,
            metadata: true,
          },
        },
        _count: {
          select: {
            contentItems: true,
            scheduledPosts: true,
            affiliateClicks: true,
          },
        },
      },
    });

    const audienceData = channels.map((channel) => {
      // Extract audience data from platformMetadata (JSONB)
      const metadata = channel.platformMetadata as Record<string, unknown> ?? {};
      const socialMetadata = channel.socialAccount.metadata as Record<string, unknown> ?? {};

      return {
        channelId: channel.id,
        channelName: channel.name,
        platform: channel.socialAccount.platform,
        username: channel.socialAccount.username,
        language: channel.primaryLanguage,
        niches: channel.niches,
        healthScore: channel.healthScore,
        audience: {
          subscribers: metadata.subscribers ?? socialMetadata.subscribers ?? null,
          followers: metadata.followers ?? socialMetadata.followers ?? null,
          totalViews: metadata.totalViews ?? socialMetadata.totalViews ?? null,
        },
        activity: {
          totalContent: channel._count.contentItems,
          scheduledPosts: channel._count.scheduledPosts,
          affiliateClicks: channel._count.affiliateClicks,
        },
      };
    });

    return success({
      totalChannels: audienceData.length,
      channels: audienceData,
    });
  } catch (err) {
    console.error('GET /api/v1/analytics/audience error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch audience insights', 500);
  }
}
