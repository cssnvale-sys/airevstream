import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, authenticateAny, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

const UpdateContentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum([
    'draft', 'generating', 'generated', 'pending_approval',
    'approved', 'scheduled', 'posted', 'archived', 'failed',
  ]).optional(),
  prompt: z.string().max(10000).optional(),
  platformMetadata: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticateAny(req, 'read');
    if (ctx instanceof NextResponse) return ctx;

    // Unconditional tenant guard (D076)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      include: {
        channel: {
          select: { id: true, name: true, primaryLanguage: true, niches: true, tone: true },
        },
        aiService: {
          select: { id: true, name: true, provider: true, serviceType: true },
        },
        affiliateProduct: {
          select: { id: true, name: true, url: true, category: true },
        },
        storyboards: {
          include: {
            shots: {
              orderBy: { shotNumber: 'asc' },
              select: {
                id: true,
                storyboardId: true,
                shotNumber: true,
                startSec: true,
                endSec: true,
                status: true,
                qualityScore: true,
                generationCost: true,
                shotspec: true,
                keyframeUrls: true,
                plateVideoUrl: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        scheduledPosts: {
          orderBy: { scheduledAt: 'asc' },
        },
        children: {
          select: {
            id: true,
            version: true,
            status: true,
            title: true,
            createdAt: true,
          },
          orderBy: { version: 'asc' },
        },
      },
    });

    if (!item) {
      return notFound('Content item not found');
    }

    // Convert Decimal fields to numbers
    const converted = {
      ...item,
      qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
      durationSec: item.durationSec != null ? Number(item.durationSec) : null,
      approvalGateWindowHrs: item.approvalGateWindowHrs != null ? Number(item.approvalGateWindowHrs) : null,
      storyboards: item.storyboards.map((sb) => ({
        ...sb,
        totalDurationSec: sb.totalDurationSec != null ? Number(sb.totalDurationSec) : null,
        shots: sb.shots.map((shot) => ({
          ...shot,
          startSec: Number(shot.startSec),
          endSec: Number(shot.endSec),
          qualityScore: shot.qualityScore != null ? Number(shot.qualityScore) : null,
          generationCost: shot.generationCost != null ? Number(shot.generationCost) : null,
        })),
      })),
    };

    return success(converted);
  } catch (err) {
    logger.error('GET /api/v1/content/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch content item', 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`content/[id]:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    // Unconditional tenant guard (D076)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const existing = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true },
    });
    if (!existing) {
      return notFound('Content item not found');
    }

    const body = await req.json();
    const parsed = UpdateContentSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }
    const { title, status, prompt, platformMetadata } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (platformMetadata !== undefined) updateData.platformMetadata = platformMetadata as any;

    const updated = await ctx.db.contentItem.update({
      where: { id },
      data: updateData,
      include: {
        channel: {
          select: { id: true, name: true },
        },
        aiService: {
          select: { id: true, name: true },
        },
      },
    });

    return success({
      ...updated,
      qualityScore: updated.qualityScore != null ? Number(updated.qualityScore) : null,
      durationSec: updated.durationSec != null ? Number(updated.durationSec) : null,
      approvalGateWindowHrs: updated.approvalGateWindowHrs != null ? Number(updated.approvalGateWindowHrs) : null,
    });
  } catch (err) {
    logger.error('PUT /api/v1/content/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update content item', 500);
  }
}

/**
 * DELETE /api/v1/content/[id]
 * Delete a content item. Only allowed for draft or archived status.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`content/[id]:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    // Unconditional tenant guard (D076)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    // Use interactive transaction to prevent TOCTOU race on status check
    const deletableStatuses = ['draft', 'archived', 'failed'];

    const result = await ctx.db.$transaction(async (tx: any) => {
      const item = await tx.contentItem.findFirst({
        where: {
          id,
          channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
        },
        select: { id: true, status: true },
      });

      if (!item) return { kind: 'not_found' as const };

      if (!deletableStatuses.includes(item.status)) {
        return { kind: 'invalid_status' as const, status: item.status };
      }

      // Cascade: storyboard shots, storyboards, scheduled posts, then content
      await tx.storyboardShot.deleteMany({
        where: { storyboard: { contentId: id } },
      });
      await tx.storyboard.deleteMany({ where: { contentId: id } });
      await tx.scheduledPost.deleteMany({ where: { contentId: id } });
      await tx.contentItem.delete({ where: { id } });

      return { kind: 'deleted' as const };
    });

    if (result.kind === 'not_found') return notFound('Content item not found');
    if (result.kind === 'invalid_status') {
      return validationError(
        `Cannot delete content with status "${result.status}". Only draft, archived, or failed content can be deleted.`,
      );
    }

    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/content/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete content item', 500);
  }
}
