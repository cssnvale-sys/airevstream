import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string; socialId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot run health checks');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`account-health:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id, socialId } = await params;
    if (!isUUID(id) || !isUUID(socialId)) return error('VALIDATION_ERROR', 'Invalid ID format', 400);

    const emailAccount = await ctx.db.emailAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!emailAccount) return notFound('Email account not found');

    const socialAccount = await ctx.db.socialAccount.findFirst({
      where: { id: socialId, emailAccountId: id },
      select: { id: true },
    });
    if (!socialAccount) return notFound('Social account not found');

    const job = await addJob('account', 'account:health-check', { socialAccountId: socialId });

    return success({ jobId: job.id, message: 'Health check started' });
  } catch (err) {
    logger.error('POST /api/v1/accounts/[id]/socials/[socialId]/health-check error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to check account health', 500);
  }
}
