import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, notFound, forbidden, formatZodErrors } from '@/lib/api-server';
import { addJob } from '@airevstream/queue';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const RepairShotSchema = z.object({
  shotId: z.string().min(1).max(100),
  storyboardId: z.string().min(1).max(100),
  contentId: z.string().min(1).max(100),
  channelId: z.string().max(100).optional().default(''),
  repairType: z.enum(['inpaint', 'face-fix', 'lighting-harmonize']),
  maskImageKey: z.string().max(500).optional(),
  lightingRefKey: z.string().max(500).optional(),
  repairPrompt: z.string().max(2000).optional(),
  denoise: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const rl = checkRateLimit(`repair:shot:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many repair requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = RepairShotSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const data = parsed.data;

    if (!ctx.tenantId) {
      return forbidden('No tenant context');
    }

    // Verify shot exists and belongs to tenant (content → channel → socialAccount → emailAccount → tenant)
    const shot = await ctx.db.storyboardShot.findFirst({
      where: {
        id: data.shotId,
        storyboard: { content: { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } },
      },
      select: { id: true, keyframeUrls: true },
    });

    if (!shot) return notFound('Shot not found');

    const keyframeUrls = shot.keyframeUrls as string[] | null;
    if (!keyframeUrls?.length) {
      return error('NO_KEYFRAMES', 'Shot has no keyframes to repair. Generate the shot first.', 400);
    }

    const job = await addJob('production', 'production:repair-shot', {
      shotId: data.shotId,
      storyboardId: data.storyboardId,
      contentId: data.contentId,
      channelId: data.channelId,
      repairType: data.repairType,
      maskImageKey: data.maskImageKey,
      lightingRefKey: data.lightingRefKey,
      repairPrompt: data.repairPrompt,
      denoise: data.denoise,
    });

    return success({
      shotId: data.shotId,
      jobId: job.id,
      repairType: data.repairType,
      status: 'generating',
      message: 'Shot repair queued',
    });
  } catch (err) {
    logger.error('[POST /content/repair-shot]', err as Error);
    return error('INTERNAL_ERROR', 'Failed to queue shot repair', 500);
  }
}
