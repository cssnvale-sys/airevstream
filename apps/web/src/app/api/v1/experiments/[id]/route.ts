import { authenticate, success, error, notFound, validationError, forbidden, isUUID } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const UpdateExperimentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  hypothesis: z.string().max(2000).optional(),
  primaryMetric: z.enum(['views', 'engagement', 'retention', 'clickRate', 'viralScore']).optional(),
  confidenceLevel: z.number().min(0.80).max(0.99).optional(),
  minSampleSize: z.number().int().min(10).max(100000).optional(),
  config: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/experiments/[id]
 */
export async function GET(req: NextRequest, { params }: { params: {  id: string  } }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return notFound('Experiment not found');

  try {
    const experiment = await ctx.db.experiment.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        variants: {
          include: {
            content: { select: { id: true, title: true, contentType: true, status: true } },
          },
        },
      },
    });

    if (!experiment) return notFound('Experiment not found');

    return success({
      ...experiment,
      confidenceLevel: Number(experiment.confidenceLevel),
      significance: experiment.significance != null ? Number(experiment.significance) : null,
      variants: experiment.variants.map(v => ({
        ...v,
        engagementRate: Number(v.engagementRate),
        completionRate: Number(v.completionRate),
        shareRate: Number(v.shareRate),
      })),
    });
  } catch (err) {
    console.error(`GET /api/v1/experiments/${id} failed:`, err);
    return error('INTERNAL_ERROR', 'Failed to fetch experiment', 500);
  }
}

/**
 * PUT /api/v1/experiments/[id]
 */
export async function PUT(req: NextRequest, { params }: { params: {  id: string  } }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot update experiments');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`experiment-update:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  const { id } = await params;
  if (!isUUID(id)) return notFound('Experiment not found');

  try {
    const existing = await ctx.db.experiment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) return notFound('Experiment not found');

    if (existing.status === 'running' || existing.status === 'evaluating') {
      return error('VALIDATION_ERROR', 'Cannot modify a running or evaluating experiment', 400);
    }

    const body = await req.json();
    const parsed = UpdateExperimentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    const experiment = await ctx.db.experiment.update({
      where: { id },
      data: {
        ...parsed.data,
        config: parsed.data.config ? (parsed.data.config as any) : undefined,
      },
      include: { variants: true },
    });

    return success({
      ...experiment,
      confidenceLevel: Number(experiment.confidenceLevel),
      significance: experiment.significance != null ? Number(experiment.significance) : null,
      variants: experiment.variants.map(v => ({
        ...v,
        engagementRate: Number(v.engagementRate),
        completionRate: Number(v.completionRate),
        shareRate: Number(v.shareRate),
      })),
    });
  } catch (err) {
    console.error(`PUT /api/v1/experiments/${id} failed:`, err);
    return error('INTERNAL_ERROR', 'Failed to update experiment', 500);
  }
}

/**
 * DELETE /api/v1/experiments/[id]
 */
export async function DELETE(req: NextRequest, { params }: { params: {  id: string  } }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot delete experiments');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`experiment-delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  const { id } = await params;
  if (!isUUID(id)) return notFound('Experiment not found');

  try {
    const existing = await ctx.db.experiment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) return notFound('Experiment not found');

    if (existing.status === 'running' || existing.status === 'evaluating') {
      return error('VALIDATION_ERROR', 'Cannot delete a running or evaluating experiment', 400);
    }

    await ctx.db.experiment.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    console.error(`DELETE /api/v1/experiments/${id} failed:`, err);
    return error('INTERNAL_ERROR', 'Failed to delete experiment', 500);
  }
}
