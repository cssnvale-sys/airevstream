import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, notFound, forbidden } from '@/lib/api-server';
import { scoreViralPotential, suggestPresetVariantForChannel } from '@airevstream/shared';
import type { ViralScoringInput, ChannelContext } from '@airevstream/shared';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const SuggestionsSchema = z.object({
  contentId: z.string().uuid(),
  currentPresets: z.array(z.string()).optional(),
});

/**
 * POST /api/v1/content/viral-suggestions
 * Get preset suggestions based on viral score analysis
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot generate suggestions');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`viral-suggestions:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  try {
    const body = await req.json();
    const parsed = SuggestionsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    const { contentId, currentPresets } = parsed.data;

    const content = await ctx.db.contentItem.findFirst({
      where: {
        id: contentId,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            niches: true,
            tone: true,
            targetAudience: true,
            socialAccount: { select: { platform: true } },
          },
        },
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

    // Check for cached score first
    const perf = (content.performance as Record<string, unknown>) ?? {};
    const cachedDimensions = perf.viralDimensions as Record<string, number> | undefined;

    let viralResult;
    if (cachedDimensions) {
      // Use cached viral score
      viralResult = {
        overall: (perf.viralScore as number) ?? 0,
        tier: (perf.viralTier as 'low' | 'medium' | 'high' | 'viral') ?? 'low',
        dimensions: cachedDimensions as any,
        shareCoefficient: (perf.shareCoefficient as number) ?? 0,
        issues: (perf.viralIssues as any[]) ?? [],
      };
    } else {
      // Compute fresh
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
      };

      viralResult = scoreViralPotential(viralInput);
    }

    // Build channel context for channel-aware suggestions
    const channelCtx: ChannelContext | undefined = content.channel ? {
      niches: content.channel.niches,
      tone: content.channel.tone ?? undefined,
      targetAudience: content.channel.targetAudience ?? undefined,
      platform: content.channel.socialAccount?.platform ?? undefined,
    } : undefined;

    const suggestions = suggestPresetVariantForChannel(viralResult, currentPresets, channelCtx);

    return success({
      suggestions,
      viralScore: viralResult.overall,
      tier: viralResult.tier,
      channelId: content.channel?.id ?? null,
    });
  } catch (err) {
    logger.error('POST /api/v1/content/viral-suggestions failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to generate suggestions', 500);
  }
}
