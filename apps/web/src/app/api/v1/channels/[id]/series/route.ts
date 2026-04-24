import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError, isUUID, parseQuery , type ApiContext } from '@/lib/api-server';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid channel ID');

    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
      select: { id: true },
    });
    if (!channel) return error('NOT_FOUND', 'Channel not found', 404);

    const { order } = parseQuery(req);

    const seriesList = await ctx.db.series.findMany({
      where: { channelId: id },
      include: {
        _count: { select: { episodes: true } },
      },
      orderBy: { sortOrder: order as 'asc' | 'desc' },
    });

    return success(seriesList);
  } catch (err) {
    logger.error('GET /api/v1/channels/[id]/series failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch channel series', 500);
  }
}
