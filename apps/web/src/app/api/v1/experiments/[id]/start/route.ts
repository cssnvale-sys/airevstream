import { authenticate, success, error, notFound, forbidden, isUUID } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/experiments/[id]/start
 * Set experiment status to running
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot start experiments');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`experiment-start:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  const { id } = await params;
  if (!isUUID(id)) return notFound('Experiment not found');

  try {
    const experiment = await ctx.db.experiment.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { variants: true },
    });
    if (!experiment) return notFound('Experiment not found');

    if (experiment.status !== 'draft') {
      return error('VALIDATION_ERROR', 'Only draft experiments can be started', 400);
    }

    if (experiment.variants.length < 2) {
      return error('VALIDATION_ERROR', 'Experiment needs at least 2 variants to start', 400);
    }

    const totalTraffic = experiment.variants.reduce((sum, v) => sum + v.trafficPercent, 0);
    if (totalTraffic !== 100) {
      return error('VALIDATION_ERROR', `Traffic allocation must sum to 100% (currently ${totalTraffic}%)`, 400);
    }

    const updated = await ctx.db.experiment.update({
      where: { id },
      data: {
        status: 'running',
        startedAt: new Date(),
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
    console.error(`POST /api/v1/experiments/${id}/start failed:`, err);
    return error('INTERNAL_ERROR', 'Failed to start experiment', 500);
  }
}
