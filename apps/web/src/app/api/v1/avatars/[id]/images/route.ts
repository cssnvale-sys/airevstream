import { authenticate, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { deleteObject } from '@airevstream/storage';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const VALID_SLOTS = ['face', 'waist', 'body_front', 'body_back'] as const;
type ImageSlot = typeof VALID_SLOTS[number];

const SetImageSchema = z.object({
  slot: z.enum(VALID_SLOTS),
  bucket: z.string().min(1),
  key: z.string().min(1),
});

/**
 * POST /api/v1/avatars/[id]/images
 * Set an image slot on the avatar
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const ctx = authResult;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`avatars/[id]/images:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const body = await req.json();
    const parsed = SetImageSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { slot, bucket, key } = parsed.data;

    const avatar = await ctx.db.avatar.findFirst({
      where: { id, tenantId: ctx.tenantId! },
    });
    if (!avatar) return notFound('Avatar not found');

    const currentImages = (avatar.images as Record<string, unknown>) ?? {};
    const updatedImages = {
      ...currentImages,
      [slot]: { bucket, key },
    };

    const updated = await ctx.db.avatar.update({
      where: { id },
      data: {
        images: updatedImages as any,
      },
    });

    return success(updated);
  } catch (err) {
    logger.error('POST /api/v1/avatars/[id]/images failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to set avatar image', 500);
  }
}

/**
 * DELETE /api/v1/avatars/[id]/images
 * Remove an image slot from the avatar
 * Query param: ?slot=face|waist|body_front|body_back
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
  const rl = checkRateLimit(`avatars/[id]/images:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  const url = new URL(req.url);
  const slot = url.searchParams.get('slot');
  if (!slot || !VALID_SLOTS.includes(slot as ImageSlot)) {
    return validationError(`Invalid slot. Must be one of: ${VALID_SLOTS.join(', ')}`);
  }

  try {
    const avatar = await ctx.db.avatar.findFirst({
      where: { id, tenantId: ctx.tenantId! },
    });
    if (!avatar) return notFound('Avatar not found');

    const currentImages = (avatar.images as Record<string, { bucket?: string; key?: string }>) ?? {};
    const oldSlotValue = currentImages[slot];

    // Remove the slot from the images object
    const { [slot]: _removed, ...remainingImages } = currentImages;

    // Clean up MinIO file if it exists (non-blocking on failure)
    if (oldSlotValue?.bucket && oldSlotValue?.key) {
      try {
        await deleteObject(oldSlotValue.bucket, oldSlotValue.key);
      } catch (cleanupErr) {
        console.error(`Failed to delete avatar image slot "${slot}" from MinIO:`, cleanupErr);
      }
    }

    const updated = await ctx.db.avatar.update({
      where: { id },
      data: {
        images: remainingImages as any,
      },
    });

    return success(updated);
  } catch (err) {
    logger.error('DELETE /api/v1/avatars/[id]/images failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to remove avatar image', 500);
  }
}
