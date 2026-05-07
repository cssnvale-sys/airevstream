import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError, isUUID, type ApiContext } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

function tenantFilter(tenantId: string) {
  return { channel: { socialAccount: { emailAccount: { tenantId } } } };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true, defaultPresetIds: true, defaultRecipeId: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    return success({
      defaultPresetIds: series.defaultPresetIds,
      defaultRecipeId: series.defaultRecipeId,
    });
  } catch (err) {
    logger.error('GET /api/v1/series/[id]/presets failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch series presets', 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot update presets', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`series-presets:update:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 20, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id } = params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const existing = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!existing) return error('NOT_FOUND', 'Series not found', 404);

    const body = await req.json();
    const { defaultPresetIds, defaultRecipeId } = body;

    const series = await ctx.db.series.update({
      where: { id },
      data: {
        ...(defaultPresetIds !== undefined ? { defaultPresetIds } : {}),
        ...(defaultRecipeId !== undefined ? { defaultRecipeId } : {}),
      },
      select: { id: true, defaultPresetIds: true, defaultRecipeId: true },
    });

    return success(series);
  } catch (err) {
    logger.error('PUT /api/v1/series/[id]/presets failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update series presets', 500);
  }
}
