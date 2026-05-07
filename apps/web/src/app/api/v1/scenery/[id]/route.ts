import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { deleteObject } from '@airevstream/storage';
import { BUCKETS } from '@airevstream/shared';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

const updateScenerySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().max(50).optional().nullable(),
  imageUrl: z.string().min(1).optional(),
  prompt: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/scenery/[id]
 * Get a single scenery asset with tenant scope.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const scenery = await ctx.db.sceneryAsset.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        channelScenery: {
          include: {
            channel: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!scenery) {
      return notFound('Scenery asset not found');
    }

    return success(scenery);
  } catch (err) {
    logger.error('GET /api/v1/scenery/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch scenery asset', 500);
  }
}

/**
 * PUT /api/v1/scenery/[id]
 * Update a scenery asset.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`scenery/[id]:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.sceneryAsset.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return notFound('Scenery asset not found');
    }

    const body = await req.json();
    const parsed = updateScenerySchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const fields = parsed.data;
    const data: Record<string, unknown> = {};

    if (fields.name !== undefined) data.name = fields.name;
    if (fields.category !== undefined) data.category = fields.category;
    if (fields.imageUrl !== undefined) data.imageUrl = fields.imageUrl;
    if (fields.prompt !== undefined) data.prompt = fields.prompt;
    if (fields.metadata !== undefined) data.metadata = fields.metadata as any;

    const updated = await ctx.db.sceneryAsset.update({
      where: { id },
      data,
    });

    return success(updated);
  } catch (err) {
    logger.error('PUT /api/v1/scenery/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update scenery asset', 500);
  }
}

/**
 * DELETE /api/v1/scenery/[id]
 * Delete a scenery asset and clean up storage.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`scenery/[id]:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.sceneryAsset.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return notFound('Scenery asset not found');
    }

    // Delete the DB record (cascades to channelScenery join rows)
    await ctx.db.sceneryAsset.delete({ where: { id } });

    // Clean up MinIO storage if imageUrl looks like a storage key (not an external URL)
    if (existing.imageUrl && !existing.imageUrl.startsWith('http')) {
      try {
        await deleteObject(BUCKETS.SCENERY, existing.imageUrl);
      } catch (storageErr) {
        logger.error('Failed to delete scenery image from storage', storageErr as Error);
        // Non-blocking — the DB record is already deleted
      }
    }

    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/scenery/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete scenery asset', 500);
  }
}
