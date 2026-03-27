import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

    const rl = checkRateLimit(`generate:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many regeneration requests', 429);
    }

    // Unconditional tenant guard (D076)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const existing = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: {
        id: true,
        channelId: true,
        title: true,
        contentType: true,
        contentPurpose: true,
        prompt: true,
        language: true,
        generationParams: true,
        affiliateProductId: true,
        affiliateMode: true,
        version: true,
        parentId: true,
        languageFamilyId: true,
      },
    });

    if (!existing) {
      return notFound('Content item not found');
    }

    // Determine the root parent ID for the version chain
    const rootId = existing.parentId ?? existing.id;

    const newVersion = await ctx.db.contentItem.create({
      data: {
        channelId: existing.channelId,
        title: existing.title,
        contentType: existing.contentType,
        contentPurpose: existing.contentPurpose,
        prompt: existing.prompt,
        language: existing.language,
        generationParams: existing.generationParams ?? {},
        affiliateProductId: existing.affiliateProductId,
        affiliateMode: existing.affiliateMode,
        languageFamilyId: existing.languageFamilyId,
        version: existing.version + 1,
        parentId: rootId,
        status: 'generating',
      },
    });

    try {
      await addJob('content', 'content:generate', {
        contentId: newVersion.id,
        channelId: existing.channelId,
        contentType: existing.contentType,
        prompt: existing.prompt ?? undefined,
      });
    } catch (jobErr) {
      console.error('Failed to enqueue regeneration job:', jobErr);
      await ctx.db.contentItem.update({
        where: { id: newVersion.id },
        data: { status: 'failed' },
      });
      return error('QUEUE_ERROR', 'Failed to start content regeneration', 500);
    }

    return success({
      ...newVersion,
      qualityScore: newVersion.qualityScore != null ? Number(newVersion.qualityScore) : null,
      durationSec: newVersion.durationSec != null ? Number(newVersion.durationSec) : null,
      approvalGateWindowHrs: newVersion.approvalGateWindowHrs != null ? Number(newVersion.approvalGateWindowHrs) : null,
    }, { queued: true });
  } catch (err) {
    console.error('POST /api/v1/content/[id]/regenerate error:', err);
    return error('INTERNAL_ERROR', 'Failed to regenerate content', 500);
  }
}
