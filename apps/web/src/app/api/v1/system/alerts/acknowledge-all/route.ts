import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/v1/system/alerts/acknowledge-all
 * Acknowledge all open alerts at once
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`system-alerts-acknowledge-all:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const result = await ctx.db.alert.updateMany({
      where: { status: 'open' },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      },
    });

    return success({ acknowledged: result.count });
  } catch (err) {
    console.error('[POST /system/alerts/acknowledge-all]', err);
    return error('INTERNAL_ERROR', 'Failed to acknowledge alerts', 500);
  }
}
