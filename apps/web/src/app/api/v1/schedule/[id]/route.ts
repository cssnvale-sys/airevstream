import { authenticate, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const RescheduleSchema = z.object({
  scheduledAt: z.string().datetime({ message: 'scheduledAt must be a valid ISO date' }).optional(),
  publishConfig: z.record(z.unknown()).optional(),
}).refine(d => d.scheduledAt !== undefined || d.publishConfig !== undefined, {
  message: 'At least one of scheduledAt or publishConfig must be provided',
});

type RouteParams = { params: { id: string } };

/**
 * PUT /api/v1/schedule/[id]
 * Reschedule a post (update scheduledAt and optionally publishConfig).
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`schedule/[id]:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.scheduledPost.findFirst({
      where: {
        id,
        // Scope to tenant via Channel -> SocialAccount -> EmailAccount chain
        channel: {
          socialAccount: {
            emailAccount: { tenantId: ctx.tenantId },
          },
        },
      },
    });
    if (!existing) return notFound('Scheduled post not found');

    if (existing.status === 'posted') {
      return validationError('Cannot reschedule an already posted item');
    }
    if (existing.status === 'posting') {
      return validationError('Cannot reschedule a post that is currently being published');
    }

    const body = await req.json();
    const parsed = RescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { scheduledAt, publishConfig } = parsed.data;
    const data: Record<string, unknown> = {};

    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return validationError('scheduledAt must be in the future');
      }
      data.scheduledAt = scheduledDate;
    }

    if (publishConfig !== undefined) {
      data.publishConfig = publishConfig as any; // Prisma InputJsonValue
    }

    // Reset status to scheduled if it was failed/cancelled
    if (existing.status === 'failed' || existing.status === 'cancelled') {
      data.status = 'scheduled';
    }

    const updated = await ctx.db.scheduledPost.update({
      where: { id },
      data,
      include: {
        content: { select: { id: true, title: true, contentType: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    return success(updated);
  } catch (err) {
    logger.error('PUT /api/v1/schedule/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to reschedule post', 500);
  }
}

/**
 * DELETE /api/v1/schedule/[id]
 * Cancel and delete a scheduled post.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`schedule/[id]:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.scheduledPost.findFirst({
      where: {
        id,
        // Scope to tenant via Channel -> SocialAccount -> EmailAccount chain
        channel: {
          socialAccount: {
            emailAccount: { tenantId: ctx.tenantId },
          },
        },
      },
    });
    if (!existing) return notFound('Scheduled post not found');

    if (existing.status === 'posted') {
      return validationError('Cannot delete an already posted item');
    }
    if (existing.status === 'posting') {
      return validationError('Cannot delete a post that is currently being published');
    }

    await ctx.db.scheduledPost.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/schedule/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to cancel scheduled post', 500);
  }
}
