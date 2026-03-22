import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { startCinemaPipeline } from '@airevstream/queue';
import type { CinemaPipelineParams } from '@airevstream/queue';

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

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

    // Start the cinema pipeline
    const flowJob = await startCinemaPipeline({
      contentId: body.contentId,
      channelId: body.channelId,
      topic: body.topic,
      contentType: body.contentType,
      cinemaBibleId: body.cinemaBibleId,
      qualityPreset: body.qualityPreset ?? 'standard',
      shotIds: body.shotIds,
      storyboardId: body.storyboardId,
    });

    return success({
      flowJobId: flowJob.job.id,
      contentId: body.contentId,
      pipelineType: 'cinema',
      qualityPreset: body.qualityPreset ?? 'standard',
    });
  } catch (err) {
    console.error('POST /api/v1/pipeline/cinema failed:', err);
    return error('INTERNAL_ERROR', 'Failed to start cinema pipeline', 500);
  }
}
