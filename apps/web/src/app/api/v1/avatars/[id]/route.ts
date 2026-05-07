import { authenticate, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { deleteObject } from '@airevstream/storage';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

const UpdateAvatarSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.record(z.unknown()).optional(),
  traitLock: z.record(z.unknown()).optional(),
  voiceProfiles: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/avatars/[id]
 * Get avatar detail with relations
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const ctx = authResult;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const avatar = await ctx.db.avatar.findFirst({
      where: { id, tenantId: ctx.tenantId! },
      include: {
        channelAvatars: {
          include: {
            channel: {
              select: { id: true, name: true },
            },
          },
        },
        seriesAvatars: {
          include: {
            series: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: {
            channelAvatars: true,
            seriesAvatars: true,
            assetRegistryEntries: true,
          },
        },
      },
    });

    if (!avatar) return notFound('Avatar not found');

    const { _count, ...rest } = avatar;

    return success({
      ...rest,
      channelAvatarsCount: _count.channelAvatars,
      seriesAvatarsCount: _count.seriesAvatars,
      assetRegistryEntriesCount: _count.assetRegistryEntries,
    });
  } catch (err) {
    logger.error('GET /api/v1/avatars/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch avatar', 500);
  }
}

/**
 * PUT /api/v1/avatars/[id]
 * Update avatar fields
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const ctx = authResult;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`avatars/[id]:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.avatar.findFirst({
      where: { id, tenantId: ctx.tenantId! },
    });
    if (!existing) return notFound('Avatar not found');

    const body = await req.json();
    const parsed = UpdateAvatarSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { name, description, traitLock, voiceProfiles } = parsed.data;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description as any;
    if (traitLock !== undefined) data.traitLock = traitLock as any;
    if (voiceProfiles !== undefined) data.voiceProfiles = voiceProfiles as any;

    const updated = await ctx.db.avatar.update({
      where: { id },
      data,
    });

    return success(updated);
  } catch (err) {
    logger.error('PUT /api/v1/avatars/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update avatar', 500);
  }
}

/**
 * DELETE /api/v1/avatars/[id]
 * Delete avatar and clean up MinIO images
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const ctx = authResult;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`avatars/[id]:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const avatar = await ctx.db.avatar.findFirst({
      where: { id, tenantId: ctx.tenantId! },
    });
    if (!avatar) return notFound('Avatar not found');

    // Clean up MinIO images (non-blocking)
    const images = avatar.images as Record<string, { bucket?: string; key?: string }> | null;
    if (images && typeof images === 'object') {
      for (const slot of Object.keys(images)) {
        const slotValue = images[slot];
        if (slotValue?.bucket && slotValue?.key) {
          try {
            await deleteObject(slotValue.bucket, slotValue.key);
          } catch (cleanupErr) {
            console.error(`Failed to delete avatar image slot "${slot}" from MinIO:`, cleanupErr);
          }
        }
      }
    }

    await ctx.db.avatar.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/avatars/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete avatar', 500);
  }
}
