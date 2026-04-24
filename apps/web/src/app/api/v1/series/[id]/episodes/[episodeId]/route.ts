import { NextRequest } from 'next/server';
import { authenticate, success, error, validationError, isUUID, type ApiContext } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string; episodeId: string }> };

function tenantFilter(tenantId: string) {
  return { channel: { socialAccount: { emailAccount: { tenantId } } } };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot update episodes', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`episode:update:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 30, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id, episodeId } = await params;
    if (!isUUID(id) || !isUUID(episodeId)) return validationError('Invalid ID');

    // Verify series belongs to tenant
    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    const existing = await ctx.db.episode.findFirst({
      where: { id: episodeId, seriesId: id },
    });
    if (!existing) return error('NOT_FOUND', 'Episode not found', 404);

    const body = await req.json();
    const { title, episodeNumber, publishedAt } = body;

    const episode = await ctx.db.episode.update({
      where: { id: episodeId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(episodeNumber !== undefined ? { episodeNumber } : {}),
        ...(publishedAt !== undefined ? { publishedAt: publishedAt ? new Date(publishedAt) : null } : {}),
      },
      include: {
        content: { select: { id: true, title: true, status: true, contentType: true, qualityScore: true } },
      },
    });

    return success({
      ...episode,
      content: episode.content ? {
        ...episode.content,
        qualityScore: episode.content.qualityScore != null ? Number(episode.content.qualityScore) : null,
      } : null,
    });
  } catch (err) {
    logger.error('PUT /api/v1/series/[id]/episodes/[episodeId] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update episode', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot delete episodes', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`episode:delete:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 10, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id, episodeId } = await params;
    if (!isUUID(id) || !isUUID(episodeId)) return validationError('Invalid ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    const existing = await ctx.db.episode.findFirst({
      where: { id: episodeId, seriesId: id },
    });
    if (!existing) return error('NOT_FOUND', 'Episode not found', 404);

    await ctx.db.episode.delete({ where: { id: episodeId } });

    // Clear denormalized seriesId on content if no other episodes reference it
    const otherEpisodes = await ctx.db.episode.count({
      where: { contentId: existing.contentId, seriesId: id },
    });
    if (otherEpisodes === 0) {
      await ctx.db.contentItem.update({
        where: { id: existing.contentId },
        data: { seriesId: null },
      });
    }

    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/series/[id]/episodes/[episodeId] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete episode', 500);
  }
}
