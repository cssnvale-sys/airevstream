import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { startCinemaPipeline } from '@airevstream/queue';
import type { CinemaPipelineParams } from '@airevstream/queue';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`pipeline-cinema:POST:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const body = (await req.json()) as Partial<CinemaPipelineParams>;

    // Validate required fields
    if (!body.contentId || !body.channelId || !body.topic || !body.contentType) {
      return error('VALIDATION_ERROR', 'Missing required fields: contentId, channelId, topic, contentType', 400);
    }

    // Validate contentType
    const validTypes = ['short', 'long', 'thumbnail', 'image'];
    if (!validTypes.includes(body.contentType)) {
      return error('VALIDATION_ERROR', `Invalid contentType. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    // Validate channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: { id: body.channelId, socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });

    if (!channel) {
      return error('NOT_FOUND', 'Channel not found', 404);
    }

    // Validate content belongs to tenant (ContentItem scopes through channel chain)
    const content = await ctx.db.contentItem.findFirst({
      where: {
        id: body.contentId,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true },
    });

    if (!content) {
      return error('NOT_FOUND', 'Content item not found', 404);
    }

    // Pre-flight validation if shotIds provided
    if (body.shotIds?.length) {
      const { runPreGenQC } = await import('@airevstream/shared');
      const shots = await ctx.db.storyboardShot.findMany({
        where: {
          id: { in: body.shotIds },
          storyboard: {
            content: {
              channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
            },
          },
        },
        select: { shotspec: true },
      });
      const specs = shots.map(s => (s.shotspec as Record<string, unknown>) ?? { promptBlocks: [] });
      const provider = (body as Record<string, unknown>).provider as string ?? 'comfyui';
      const requestedTier = (body.qualityTier ?? 'standard') as 'draft' | 'standard' | 'cinema';
      const qcResult = runPreGenQC(specs as any[], provider as any, undefined, requestedTier);

      const qcErrors = qcResult.violations.filter(v => v.severity === 'error');
      if (qcErrors.length > 0) {
        return error('VALIDATION_ERROR', `Pre-flight check failed: ${qcErrors.length} violation(s)`, 400);
      }
    }

    // Start the cinema pipeline
    const flowJob = await startCinemaPipeline({
      tenantId: ctx.tenantId!,
      contentId: body.contentId,
      channelId: body.channelId,
      topic: body.topic,
      contentType: body.contentType,
      cinemaBibleId: body.cinemaBibleId,
      qualityTier: body.qualityTier ?? 'standard',
      shotIds: body.shotIds,
      storyboardId: body.storyboardId,
      directives: body.directives,
      overrides: body.overrides,
      duration: body.duration,
    });

    return success({
      flowJobId: flowJob.job.id,
      contentId: body.contentId,
      pipelineType: 'cinema',
      qualityTier: body.qualityTier ?? 'standard',
    });
  } catch (err) {
    console.error('POST /api/v1/pipeline/cinema failed:', err);
    return error('INTERNAL_ERROR', 'Failed to start cinema pipeline', 500);
  }
}
