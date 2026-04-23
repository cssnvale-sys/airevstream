import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, notFound, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { generateC2PAManifest } from '@airevstream/shared';
import type { ProvenanceRecord } from '@airevstream/shared';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ProvenanceQuerySchema = z.object({
  contentId: z.string().min(1).max(100),
});

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.tenantId) return forbidden('No tenant context');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`content/provenance:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { searchParams } = new URL(req.url);
  const parsed = ProvenanceQuerySchema.safeParse({ contentId: searchParams.get('contentId') });
  if (!parsed.success) {
    return validationError('contentId is required');
  }

  try {
    const { contentId } = parsed.data;

    // Load content with storyboard and shots
    const content = await ctx.db.contentItem.findFirst({
      where: {
        id: contentId,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: {
        id: true,
        title: true,
        storyboards: {
          select: {
            shots: {
              select: {
                id: true,
                shotNumber: true,
                shotspec: true,
                keyframeUrls: true,
                qualityScore: true,
              },
              orderBy: { shotNumber: 'asc' },
            },
          },
          take: 1,
        },
      },
    });

    if (!content) return notFound('Content not found');

    const shots = content.storyboards[0]?.shots ?? [];

    // Extract provenance data from shot specs
    const records: ProvenanceRecord[] = shots.map(shot => {
      const spec = (shot.shotspec as Record<string, unknown>) ?? {};
      const gen = (spec.generation as Record<string, unknown>) ?? {};
      const keyframes = shot.keyframeUrls as string[] | null;

      return {
        id: (spec.provenance as string) ?? `prov-${shot.id}`,
        timestamp: new Date().toISOString(),
        type: 'image' as const,
        model: {
          name: (spec.model as string) ?? 'sd_xl_base_1.0',
          provider: (gen.provider as string) ?? 'comfyui',
        },
        parameters: {
          prompt: (spec.promptBlocks as string[])?.join(', '),
          seed: spec.seed as number | undefined,
          steps: gen.steps as number | undefined,
          cfg: gen.cfg as number | undefined,
          sampler: gen.sampler as string | undefined,
          width: gen.width as number | undefined,
          height: gen.height as number | undefined,
        },
        inputs: [],
        output: {
          storageKey: keyframes?.[0] ?? '',
        },
        stage: 'shot-generation',
        qualityScore: shot.qualityScore ? Number(shot.qualityScore) : undefined,
      };
    });

    // Generate C2PA manifest
    const manifest = generateC2PAManifest(content.title ?? 'Untitled', records);

    return success({
      contentId,
      title: content.title,
      records,
      manifest,
      safetyScores: shots.map(s => ({
        shotNumber: (s.shotspec as Record<string, unknown>)?.shotNumber ?? s.shotNumber,
        safetyScore: ((s.shotspec as Record<string, unknown>)?.safetyScore as number) ?? 0,
      })),
    });
  } catch (err) {
    logger.error('[GET /content/provenance]', err as Error);
    return error('INTERNAL_ERROR', 'Failed to load provenance data', 500);
  }
}
