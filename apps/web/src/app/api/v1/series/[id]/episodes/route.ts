import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, paginated, error, validationError, isUUID, parseQuery, type ApiContext } from '@/lib/api-server';
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

    // Verify series belongs to tenant
    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    const { page, limit, skip, order } = parseQuery(req);

    const [episodes, total] = await Promise.all([
      ctx.db.episode.findMany({
        where: { seriesId: id },
        include: {
          content: { select: { id: true, title: true, status: true, contentType: true, thumbnailUrl: true, qualityScore: true } },
        },
        orderBy: { position: order as 'asc' | 'desc' },
        skip,
        take: limit,
      }),
      ctx.db.episode.count({ where: { seriesId: id } }),
    ]);

    const mapped = episodes.map((e) => ({
      ...e,
      content: e.content ? {
        ...e.content,
        qualityScore: e.content.qualityScore != null ? Number(e.content.qualityScore) : null,
      } : null,
    }));

    return paginated(mapped, total, page, limit);
  } catch (err) {
    logger.error('GET /api/v1/series/[id]/episodes failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch episodes', 500);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot add episodes', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`episode:create:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 30, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    const body = await req.json();
    const { contentId, title, episodeNumber } = body;

    if (!contentId) return validationError('contentId is required');
    if (!isUUID(contentId)) return validationError('Invalid contentId');

    // Verify content belongs to tenant
    const content = await ctx.db.contentItem.findFirst({
      where: { id: contentId, channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } },
      select: { id: true },
    });
    if (!content) return error('NOT_FOUND', 'Content not found', 404);

    // Determine episode number and position
    const lastEpisode = await ctx.db.episode.findFirst({
      where: { seriesId: id },
      orderBy: { episodeNumber: 'desc' },
      select: { episodeNumber: true, position: true },
    });

    const newEpisodeNumber = episodeNumber ?? (lastEpisode ? lastEpisode.episodeNumber + 1 : 1);
    const newPosition = lastEpisode ? lastEpisode.position + 1 : 0;

    const episode = await ctx.db.episode.create({
      data: {
        seriesId: id,
        contentId,
        episodeNumber: newEpisodeNumber,
        position: newPosition,
        title: title ?? null,
      },
      include: {
        content: { select: { id: true, title: true, status: true, contentType: true } },
      },
    });

    // Update content's seriesId (denormalized field)
    await ctx.db.contentItem.update({
      where: { id: contentId },
      data: { seriesId: id },
    });

    return success(episode);
  } catch (err) {
    logger.error('POST /api/v1/series/[id]/episodes failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to add episode', 500);
  }
}
