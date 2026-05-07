import { NextRequest, NextResponse } from 'next/server';
import { authenticateAny, success, error, notFound, isUUID, validationError } from '@/lib/api-server';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

/**
 * GET /api/v1/channels/[id]/viral-stats
 * Per-channel viral score trends from ContentItem performance JSON
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
      select: { id: true, name: true },
    });
    if (!channel) return notFound('Channel not found');

    // Get content items with viral scores
    const contentItems = await ctx.db.contentItem.findMany({
      where: { channelId: id },
      select: {
        id: true,
        title: true,
        contentType: true,
        status: true,
        performance: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Extract viral scores from performance JSON
    const scored = contentItems
      .map((item) => {
        const perf = (item.performance as Record<string, unknown>) ?? {};
        const viralScore = perf.viralScore as number | undefined;
        const viralTier = perf.viralTier as string | undefined;
        return {
          id: item.id,
          title: item.title,
          contentType: item.contentType,
          status: item.status,
          viralScore: viralScore ?? null,
          viralTier: viralTier ?? null,
          createdAt: item.createdAt,
        };
      })
      .filter((item) => item.viralScore != null);

    // Compute stats
    const scores = scored.map(s => s.viralScore!);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Top content by viral score
    const topContent = [...scored].sort((a, b) => (b.viralScore ?? 0) - (a.viralScore ?? 0)).slice(0, 5);

    // Score trend (last 20 items chronologically)
    const trend = [...scored].reverse().slice(0, 20).map(s => ({
      date: s.createdAt,
      score: s.viralScore,
    }));

    // Tier distribution
    const tierCounts: Record<string, number> = { low: 0, medium: 0, high: 0, viral: 0 };
    for (const item of scored) {
      if (item.viralTier && item.viralTier in tierCounts) {
        tierCounts[item.viralTier]++;
      }
    }

    return success({
      channel: { id: channel.id, name: channel.name },
      totalContent: contentItems.length,
      scoredContent: scored.length,
      avgScore,
      maxScore,
      minScore,
      topContent,
      trend,
      tierCounts,
    });
  } catch (err) {
    logger.error('GET /api/v1/channels/[id]/viral-stats failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch viral stats', 500);
  }
}
