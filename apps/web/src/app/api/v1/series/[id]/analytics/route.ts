import { NextRequest } from 'next/server';
import { authenticate, success, error, validationError, isUUID } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

function tenantFilter(tenantId: string) {
  return { channel: { socialAccount: { emailAccount: { tenantId } } } };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true, name: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    // Aggregate episode stats
    const episodes = await ctx.db.episode.findMany({
      where: { seriesId: id },
      include: {
        content: {
          select: {
            status: true,
            qualityScore: true,
            performance: true,
          },
        },
      },
    });

    const totalEpisodes = episodes.length;
    const publishedEpisodes = episodes.filter((e) => e.publishedAt != null).length;
    const avgQualityScore = totalEpisodes > 0
      ? episodes.reduce((sum, e) => sum + (e.content?.qualityScore ? Number(e.content.qualityScore) : 0), 0) / totalEpisodes
      : 0;

    const statusBreakdown: Record<string, number> = {};
    for (const ep of episodes) {
      const st = ep.content?.status ?? 'unknown';
      statusBreakdown[st] = (statusBreakdown[st] ?? 0) + 1;
    }

    return success({
      seriesId: id,
      seriesName: series.name,
      totalEpisodes,
      publishedEpisodes,
      avgQualityScore: Math.round(avgQualityScore * 10) / 10,
      statusBreakdown,
    });
  } catch (err) {
    console.error('GET /api/v1/series/[id]/analytics failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch series analytics', 500);
  }
}
