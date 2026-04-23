import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, notFound } from '@/lib/api-server';
import { scoreViralPotential } from '@airevstream/shared';
import type { ViralScoringInput } from '@airevstream/shared';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const TRENDING_ENTRIES_LIMIT = 20;
const VIRAL_SCORE_CACHE_AGE_MS = 3_600_000;

export const dynamic = 'force-dynamic';

const ViralScoreQuerySchema = z.object({
  contentId: z.string().min(1).max(100),
});

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`content/viral-score:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { searchParams } = new URL(req.url);
  const parsed = ViralScoreQuerySchema.safeParse({ contentId: searchParams.get('contentId') });
  if (!parsed.success) {
    return validationError('contentId is required');
  }

  try {
    const { contentId } = parsed.data;

    const content = await ctx.db.contentItem.findFirst({
      where: {
        id: contentId,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      include: {
        channel: { select: { id: true, name: true, socialAccount: { select: { platform: true } } } },
        storyboards: {
          select: {
            totalDurationSec: true,
            shots: {
              select: { shotNumber: true, startSec: true, endSec: true, qualityScore: true, shotspec: true },
              orderBy: { shotNumber: 'asc' },
            },
          },
          take: 1,
        },
      },
    });

    if (!content) return notFound('Content not found');

    // Check if we have a cached viral score
    const perf = (content.performance as Record<string, unknown>) ?? {};
    const cachedScore = perf.viralScore as number | undefined;
    const cachedAt = perf.scoredAt as string | undefined;

    // Return cached score if less than 1 hour old
    if (cachedScore != null && cachedAt) {
      const age = Date.now() - new Date(cachedAt).getTime();
      if (age < VIRAL_SCORE_CACHE_AGE_MS) {
        return success({
          contentId,
          overall: cachedScore,
          tier: perf.viralTier,
          dimensions: perf.viralDimensions,
          issues: perf.viralIssues,
          shareCoefficient: perf.shareCoefficient,
          cached: true,
          scoredAt: cachedAt,
        });
      }
    }

    // Fetch trending topics for alignment (tenant-scoped)
    const trendEntries = await ctx.db.knowledgeBaseEntry.findMany({
      where: { category: 'trends', tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
      take: TRENDING_ENTRIES_LIMIT,
      select: { title: true },
    });

    const storyboard = content.storyboards[0];
    const shots = storyboard?.shots ?? [];
    const script = (content.platformMetadata as Record<string, unknown>)?.script as string | undefined;

    const viralInput: ViralScoringInput = {
      title: content.title ?? undefined,
      script,
      contentType: content.contentType,
      platform: content.channel?.socialAccount?.platform ?? undefined,
      durationSec: storyboard?.totalDurationSec != null ? Number(storyboard.totalDurationSec) : undefined,
      shotCount: shots.length,
      shotDurations: shots.map(s => Number(s.endSec ?? 0) - Number(s.startSec ?? 0)),
      qualityScores: shots.filter(s => s.qualityScore != null).map(s => Number(s.qualityScore)),
      trendingTopics: trendEntries.map(e => e.title),
      hasMusic: shots.some(s => {
        const spec = s.shotspec as Record<string, unknown> | null;
        return spec?.audioPlan != null;
      }),
      hasFace: shots.some(s => {
        const spec = s.shotspec as Record<string, unknown> | null;
        const prompt = ((spec?.promptBlocks as string[]) ?? []).join(' ').toLowerCase();
        return /\b(face|portrait|person|character|man|woman|girl|boy)\b/.test(prompt);
      }),
      hasCTA: script ? /\b(subscribe|follow|like|share|comment|link)\b/i.test(script) : false,
    };

    const result = scoreViralPotential(viralInput);

    // Cache the result
    await ctx.db.contentItem.update({
      where: { id: contentId },
      data: {
        performance: {
          ...perf,
          viralScore: result.overall,
          viralTier: result.tier,
          viralDimensions: result.dimensions,
          viralIssues: result.issues,
          shareCoefficient: result.shareCoefficient,
          scoredAt: new Date().toISOString(),
        } as any,
      },
    });

    return success({
      contentId,
      overall: result.overall,
      tier: result.tier,
      dimensions: result.dimensions,
      issues: result.issues,
      shareCoefficient: result.shareCoefficient,
      cached: false,
      scoredAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[GET /content/viral-score]', err as Error);
    return error('INTERNAL_ERROR', 'Failed to compute viral score', 500);
  }
}
