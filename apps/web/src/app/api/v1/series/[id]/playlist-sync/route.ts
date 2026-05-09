import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError, isUUID, type ApiContext } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function tenantFilter(tenantId: string) {
  return { channel: { socialAccount: { emailAccount: { tenantId } } } };
}

/**
 * Trigger YouTube playlist sync for a series.
 * Currently a stub — will integrate with YouTube Data API when ready.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot trigger sync', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`playlist-sync:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true, youtubePlaylistId: true, name: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    if (!series.youtubePlaylistId) {
      return validationError('No YouTube playlist ID configured for this series');
    }

    // TODO: Queue a SeriesPlaylistSyncJob when YouTube integration is ready
    return success({
      status: 'stub',
      message: `Playlist sync for "${series.name}" will be available when YouTube API integration is complete`,
      youtubePlaylistId: series.youtubePlaylistId,
    });
  } catch (err) {
    logger.error('POST /api/v1/series/[id]/playlist-sync failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to trigger playlist sync', 500);
  }
}
