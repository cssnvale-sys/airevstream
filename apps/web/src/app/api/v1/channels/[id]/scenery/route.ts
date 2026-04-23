import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

const assignScenerySchema = z.object({
  sceneryId: z.string().uuid(),
});

/**
 * GET /api/v1/channels/[id]/scenery
 * List scenery assigned to a channel.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    const channelScenery = await ctx.db.channelScenery.findMany({
      where: { channelId: id },
      include: {
        scenery: true,
      },
    });

    const data = channelScenery.map((cs) => cs.scenery);

    return success(data);
  } catch (err) {
    logger.error('GET /api/v1/channels/[id]/scenery error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to list channel scenery', 500);
  }
}

/**
 * POST /api/v1/channels/[id]/scenery
 * Assign a scenery asset to a channel.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`channels-scenery:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    const body = await req.json();
    const parsed = assignScenerySchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }
    const { sceneryId } = parsed.data;

    // Verify scenery asset exists and belongs to tenant
    const scenery = await ctx.db.sceneryAsset.findFirst({
      where: { id: sceneryId, tenantId: ctx.tenantId },
    });
    if (!scenery) return notFound('Scenery asset not found');

    // Check if already assigned
    const existing = await ctx.db.channelScenery.findUnique({
      where: { channelId_sceneryId: { channelId: id, sceneryId } },
    });
    if (existing) {
      return error('CONFLICT', 'Scenery is already assigned to this channel', 409);
    }

    const channelScenery = await ctx.db.channelScenery.create({
      data: {
        channelId: id,
        sceneryId,
      },
      include: {
        scenery: true,
      },
    });

    return success(channelScenery.scenery);
  } catch (err) {
    logger.error('POST /api/v1/channels/[id]/scenery error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to assign scenery to channel', 500);
  }
}

/**
 * DELETE /api/v1/channels/[id]/scenery
 * Unassign a scenery asset from a channel.
 * Requires sceneryId query parameter.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`channels-scenery:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const url = new URL(req.url);
    const sceneryId = url.searchParams.get('sceneryId');
    if (!sceneryId || !isUUID(sceneryId)) {
      return validationError('sceneryId query parameter is required and must be a valid UUID');
    }

    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    // Verify the assignment exists
    const existing = await ctx.db.channelScenery.findUnique({
      where: { channelId_sceneryId: { channelId: id, sceneryId } },
    });
    if (!existing) {
      return notFound('Scenery is not assigned to this channel');
    }

    await ctx.db.channelScenery.delete({
      where: { channelId_sceneryId: { channelId: id, sceneryId } },
    });

    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/channels/[id]/scenery error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to unassign scenery from channel', 500);
  }
}
