import { authenticate, success, error, notFound, forbidden, isUUID } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/experiments/[id]/stop
 * Set experiment status to stopped
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot stop experiments');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`experiment-stop:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  const { id } = await params;
  if (!isUUID(id)) return notFound('Experiment not found');

  try {
    const experiment = await ctx.db.experiment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!experiment) return notFound('Experiment not found');

    if (experiment.status !== 'running' && experiment.status !== 'evaluating') {
      return error('VALIDATION_ERROR', 'Only running or evaluating experiments can be stopped', 400);
    }

    const updated = await ctx.db.experiment.update({
      where: { id },
      data: {
        status: 'stopped',
        endedAt: new Date(),
      },
      include: { variants: true },
    });

    return success({
      ...updated,
      confidenceLevel: Number(updated.confidenceLevel),
      significance: updated.significance != null ? Number(updated.significance) : null,
      variants: updated.variants.map(v => ({
        ...v,
        engagementRate: Number(v.engagementRate),
        completionRate: Number(v.completionRate),
        shareRate: Number(v.shareRate),
      })),
    });
  } catch (err) {
    console.error(`POST /api/v1/experiments/${id}/stop failed:`, err);
    return error('INTERNAL_ERROR', 'Failed to stop experiment', 500);
  }
}
