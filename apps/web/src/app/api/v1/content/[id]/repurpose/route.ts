import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const RepurposeSchema = z.object({
  targetFormat: z.enum(['short', 'reel', 'story']),
  targetPlatforms: z.array(z.string().min(1)).min(1).max(10),
  targetDuration: z.number().min(5).max(300).optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot repurpose content');
    }

    // Unconditional tenant guard (D076)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`repurpose:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid content ID format');

    const body = await req.json();
    const parsed = RepurposeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues.map(i => i.message).join(', '));

    const { targetFormat, targetPlatforms, targetDuration } = parsed.data;

    // Find source content
    const source = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      include: {
        channel: { select: { id: true, name: true, primaryLanguage: true } },
        storyboards: { include: { shots: { orderBy: { shotNumber: 'asc' } } } },
      },
    });

    if (!source) return notFound('Content item not found');
    if (!['generated', 'approved', 'posted'].includes(source.status)) {
      return error('INVALID_STATUS', 'Content must be generated or approved to repurpose', 400);
    }

    // Create child content item
    const nextVersion = await ctx.db.contentItem.count({
      where: { parentId: source.id },
    });

    const newContent = await ctx.db.contentItem.create({
      data: {
        channelId: source.channelId,
        parentId: source.id,
        version: nextVersion + 2,
        title: `${source.title} (${targetFormat})`,
        contentType: 'video_short',
        status: 'draft',
        prompt: source.prompt,
        platformMetadata: {
          ...(source.platformMetadata as Record<string, unknown> ?? {}),
          targetFormat,
          targetPlatforms,
          targetDuration: targetDuration ?? (targetFormat === 'story' ? 15 : 60),
          repurposedFrom: source.id,
        } as any,
      },
    });

    return success({
      id: newContent.id,
      title: newContent.title,
      contentType: newContent.contentType,
      status: newContent.status,
      repurposedFrom: source.id,
    });
  } catch (err) {
    logger.error('POST /api/v1/content/[id]/repurpose failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to repurpose content', 500);
  }
}
