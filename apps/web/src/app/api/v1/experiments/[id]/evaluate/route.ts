import { authenticate, success, error, notFound, forbidden, isUUID } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/experiments/[id]/evaluate
 * Queue an experiment evaluation job
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot evaluate experiments');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`experiment-evaluate:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  const { id } = await params;
  if (!isUUID(id)) return notFound('Experiment not found');

  try {
    const experiment = await ctx.db.experiment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!experiment) return notFound('Experiment not found');

    if (experiment.status !== 'running') {
      return error('VALIDATION_ERROR', 'Only running experiments can be evaluated', 400);
    }

    await addJob('experiment', 'experiment:evaluate', {
      experimentId: id,
      tenantId: ctx.tenantId,
    });

    return success({ queued: true, experimentId: id });
  } catch (err) {
    console.error(`POST /api/v1/experiments/${id}/evaluate failed:`, err);
    return error('INTERNAL_ERROR', 'Failed to queue evaluation', 500);
  }
}
