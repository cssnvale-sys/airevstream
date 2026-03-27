import { NextRequest } from 'next/server';
import { authenticate, success, error, validationError, isUUID, type ApiContext } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

function tenantFilter(tenantId: string) {
  return { channel: { socialAccount: { emailAccount: { tenantId } } } };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot reorder episodes', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`episode:reorder:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 20, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    const body = await req.json();
    const { episodeIds } = body;

    if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
      return validationError('episodeIds array is required');
    }

    // Validate all entries are UUIDs
    for (const eid of episodeIds) {
      if (typeof eid !== 'string' || !isUUID(eid)) {
        return validationError('All episodeIds must be valid UUIDs');
      }
    }

    // Verify all episodes belong to this series
    const episodeCount = await ctx.db.episode.count({
      where: { id: { in: episodeIds }, seriesId: id },
    });
    if (episodeCount !== episodeIds.length) {
      return validationError('One or more episodeIds do not belong to this series');
    }

    // Batch update positions
    await ctx.db.$transaction(
      episodeIds.map((episodeId: string, index: number) =>
        ctx.db.episode.update({
          where: { id: episodeId },
          data: { position: index },
        }),
      ),
    );

    return success({ reordered: true });
  } catch (err) {
    console.error('PUT /api/v1/series/[id]/episodes/reorder failed:', err);
    return error('INTERNAL_ERROR', 'Failed to reorder episodes', 500);
  }
}
