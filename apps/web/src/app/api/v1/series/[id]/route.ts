import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError, isUUID, type ApiContext } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

function tenantFilter(tenantId: string) {
  return { channel: { socialAccount: { emailAccount: { tenantId } } } };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      include: {
        channel: { select: { id: true, name: true } },
        seriesAvatars: { include: { avatar: { select: { id: true, name: true, images: true } } } },
        _count: { select: { episodes: true, contentItems: true } },
      },
    });

    if (!series) return error('NOT_FOUND', 'Series not found', 404);
    return success(series);
  } catch (err) {
    logger.error('GET /api/v1/series/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch series', 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot update series', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`series:update:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 30, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const existing = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
    });
    if (!existing) return error('NOT_FOUND', 'Series not found', 404);

    const body = await req.json();
    const { name, description, status, sortOrder, coverImageUrl, targetAudience, tags, defaultPresetIds, defaultRecipeId, bibleOverrides, postingCadence, youtubePlaylistId, baseSeed } = body;

    const series = await ctx.db.series.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
        ...(targetAudience !== undefined ? { targetAudience } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(defaultPresetIds !== undefined ? { defaultPresetIds } : {}),
        ...(defaultRecipeId !== undefined ? { defaultRecipeId } : {}),
        ...(bibleOverrides !== undefined ? { bibleOverrides: bibleOverrides as any } : {}),
        ...(postingCadence !== undefined ? { postingCadence: postingCadence as any } : {}),
        ...(youtubePlaylistId !== undefined ? { youtubePlaylistId } : {}),
        ...(baseSeed !== undefined ? { baseSeed } : {}),
      },
      include: {
        channel: { select: { id: true, name: true } },
        _count: { select: { episodes: true } },
      },
    });

    return success(series);
  } catch (err) {
    logger.error('PUT /api/v1/series/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update series', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot delete series', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`series:delete:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 10, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const existing = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
    });
    if (!existing) return error('NOT_FOUND', 'Series not found', 404);

    await ctx.db.series.delete({ where: { id } });
    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/series/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete series', 500);
  }
}
