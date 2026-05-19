import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError, isUUID, type ApiContext } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { resolveSeriesBible } from '@airevstream/shared';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

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
      select: {
        id: true,
        bibleOverrides: true,
        channel: {
          select: {
            cinemaBibles: {
              take: 1,
              orderBy: { updatedAt: 'desc' },
              select: { lookBible: true, characterBible: true, environmentBible: true, promptBible: true },
            },
          },
        },
      },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    const bible = series.channel.cinemaBibles[0];
    const channelBible = bible
      ? { look: bible.lookBible, character: bible.characterBible, environment: bible.environmentBible, prompt: bible.promptBible } as Record<string, unknown>
      : {} as Record<string, unknown>;
    const overrides = (series.bibleOverrides ?? {}) as Record<string, unknown>;
    const resolved = resolveSeriesBible(channelBible, overrides);

    return success({
      resolved,
      overrides,
      channelBible,
    });
  } catch (err) {
    logger.error('GET /api/v1/series/[id]/bible failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch series bible', 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot update bible', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`series-bible:update:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 20, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const existing = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!existing) return error('NOT_FOUND', 'Series not found', 404);

    const body = await req.json();
    const { bibleOverrides } = body;

    if (bibleOverrides === undefined) return validationError('bibleOverrides is required');

    const series = await ctx.db.series.update({
      where: { id },
      data: { bibleOverrides: bibleOverrides as Prisma.InputJsonValue },
      select: { id: true, bibleOverrides: true },
    });

    return success(series);
  } catch (err) {
    logger.error('PUT /api/v1/series/[id]/bible failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update series bible', 500);
  }
}
