import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

const UpdateOutcomeSchema = z.object({
  outcome: z.enum(['accepted', 'rejected', 'ignored']),
});

/**
 * PATCH /api/v1/suggestions/[id]
 * Update suggestion outcome (accepted/rejected/ignored)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot update suggestions');
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`suggestions:patch:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.suggestionLog.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) return notFound('Suggestion not found');

    const body = await req.json();
    const parsed = UpdateOutcomeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    const updated = await ctx.db.suggestionLog.update({
      where: { id },
      data: { outcome: parsed.data.outcome },
    });

    return success(updated);
  } catch (err) {
    logger.error('PATCH /api/v1/suggestions/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update suggestion', 500);
  }
}
