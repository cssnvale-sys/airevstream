import { authenticate, success, error, forbidden } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { startAccountLifecyclePipeline } from '@airevstream/queue';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/accounts/[id]/lifecycle/retry
 * Retry a failed lifecycle pipeline
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') return forbidden('Viewers cannot perform this action');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`lifecycle:retry:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const emailAccount = await ctx.db.emailAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!emailAccount) return error('NOT_FOUND', 'Email account not found', 404);

    const lifecycle = await ctx.db.accountLifecycle.findUnique({
      where: { emailAccountId: id },
    });
    if (!lifecycle) return error('NOT_FOUND', 'No lifecycle found for this account', 404);
    if (lifecycle.status !== 'failed') {
      return error('BAD_REQUEST', 'Can only retry failed lifecycles', 400);
    }

    const result = await startAccountLifecyclePipeline({
      emailAccountId: id,
      tenantId: ctx.tenantId,
      targetPlatforms: lifecycle.targetPlatforms,
      avatarId: lifecycle.avatarId ?? undefined,
      autoSeasoning: lifecycle.autoSeasoning,
      autoPosting: lifecycle.autoPosting,
    });

    return success({ jobId: result.jobId, status: 'retrying' });
  } catch (err) {
    logger.error('POST /api/v1/accounts/[id]/lifecycle/retry failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to retry lifecycle', 500);
  }
}
