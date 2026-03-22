import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, forbidden, isUUID, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can revoke API keys');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-apikeys-revoke:POST:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.apiKey.findUnique({ where: { id } });
    if (!existing) return notFound('API key not found');

    if (ctx.tenantId && existing.tenantId !== ctx.tenantId) {
      return forbidden('Cannot revoke API keys from another tenant');
    }

    await ctx.db.apiKey.update({
      where: { id },
      data: { status: 'revoked' },
    });

    return success({ id, revoked: true });
  } catch (err) {
    console.error('POST /api/v1/settings/api-keys/[id]/revoke error:', err);
    return error('INTERNAL_ERROR', 'Failed to revoke API key', 500);
  }
}
