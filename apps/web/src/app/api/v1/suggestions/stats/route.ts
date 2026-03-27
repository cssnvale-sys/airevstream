import { NextRequest, NextResponse } from 'next/server';
import { authenticateAny, success, error } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/suggestions/stats
 * Aggregated suggestion stats: acceptance rate, per-preset rates, avg viral improvement
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId') ?? undefined;

  try {
    const where: Record<string, unknown> = { tenantId: ctx.tenantId };
    if (channelId) where.channelId = channelId;

    // Total shown
    const totalShown = await ctx.db.suggestionLog.count({ where });
    const accepted = await ctx.db.suggestionLog.count({ where: { ...where, outcome: 'accepted' } });
    const rejected = await ctx.db.suggestionLog.count({ where: { ...where, outcome: 'rejected' } });

    const acceptanceRate = totalShown > 0 ? accepted / totalShown : 0;

    // Average viral score improvement (only where both before/after exist)
    const withScores = await ctx.db.suggestionLog.findMany({
      where: {
        ...where,
        outcome: 'accepted',
        viralScoreBefore: { not: null },
        viralScoreAfter: { not: null },
      },
      select: { viralScoreBefore: true, viralScoreAfter: true },
    });

    let avgImprovement = 0;
    if (withScores.length > 0) {
      const totalImprovement = withScores.reduce(
        (sum, log) => sum + ((log.viralScoreAfter ?? 0) - (log.viralScoreBefore ?? 0)),
        0,
      );
      avgImprovement = totalImprovement / withScores.length;
    }

    // Per-preset acceptance rates (top 10)
    const presetStats = await ctx.db.suggestionLog.groupBy({
      by: ['presetId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const presetRates = await Promise.all(
      presetStats.map(async (ps) => {
        const presetAccepted = await ctx.db.suggestionLog.count({
          where: { ...where, presetId: ps.presetId, outcome: 'accepted' },
        });
        return {
          presetId: ps.presetId,
          shown: ps._count.id,
          accepted: presetAccepted,
          acceptanceRate: ps._count.id > 0 ? presetAccepted / ps._count.id : 0,
        };
      }),
    );

    // Top preset by acceptance rate (min 3 shown)
    const topPreset = presetRates
      .filter(p => p.shown >= 3)
      .sort((a, b) => b.acceptanceRate - a.acceptanceRate)[0] ?? null;

    // Recent suggestions (last 10)
    const recent = await ctx.db.suggestionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        channel: { select: { id: true, name: true } },
        content: { select: { id: true, title: true } },
      },
    });

    return success({
      totalShown,
      accepted,
      rejected,
      acceptanceRate,
      avgImprovement,
      topPreset,
      presetRates,
      recent,
    });
  } catch (err) {
    console.error('GET /api/v1/suggestions/stats failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch suggestion stats', 500);
  }
}
