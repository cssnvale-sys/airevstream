import { authenticate, success, error, notFound, isUUID, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/system/alerts/[id]/acknowledge
 * Acknowledge an alert (set acknowledgedAt=now, status='acknowledged').
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`system-alerts-acknowledge:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.alert.findUnique({ where: { id } });
    if (!existing) return notFound('Alert not found');

    // Verify tenant ownership (tenant-specific alert must belong to this tenant)
    if (existing.tenantId !== null && existing.tenantId !== ctx.tenantId) {
      return notFound('Alert not found');
    }

    if (existing.status === 'resolved') {
      return success({ message: 'Alert is already resolved', alert: existing });
    }

    const updated = await ctx.db.alert.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      },
    });

    return success(updated);
  } catch (err) {
    logger.error('POST /api/v1/system/alerts/[id]/acknowledge error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to acknowledge alert', 500);
  }
}
