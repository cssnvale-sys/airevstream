import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, forbidden, isUUID, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can revoke API keys');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-apikeys-revoke:POST:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    if (!ctx.tenantId) {
      return error('FORBIDDEN', 'No tenant context', 403);
    }

    const existing = await ctx.db.apiKey.findUnique({ where: { id } });
    if (!existing) return notFound('API key not found');

    if (existing.tenantId !== ctx.tenantId) {
      return forbidden('Cannot revoke API keys from another tenant');
    }

    await ctx.db.apiKey.update({
      where: { id },
      data: { status: 'revoked' },
    });

    return success({ id, revoked: true });
  } catch (err) {
    logger.error('POST /api/v1/settings/api-keys/[id]/revoke error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to revoke API key', 500);
  }
}
