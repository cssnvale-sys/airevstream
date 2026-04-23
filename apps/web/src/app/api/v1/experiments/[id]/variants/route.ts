import { authenticate, success, error, notFound, validationError, forbidden, isUUID } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const CreateVariantSchema = z.object({
  label: z.string().min(1).max(255),
  trafficPercent: z.number().int().min(1).max(99),
  presetOverrides: z.record(z.unknown()).optional(),
  contentId: z.string().uuid().optional(),
});

/**
 * GET /api/v1/experiments/[id]/variants
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return notFound('Experiment not found');

  try {
    const experiment = await ctx.db.experiment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!experiment) return notFound('Experiment not found');

    const variants = await ctx.db.experimentVariant.findMany({
      where: { experimentId: id },
      include: {
        content: { select: { id: true, title: true, contentType: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return success(variants.map(v => ({
      ...v,
      engagementRate: Number(v.engagementRate),
      completionRate: Number(v.completionRate),
      shareRate: Number(v.shareRate),
    })));
  } catch (err) {
    console.error(`GET /api/v1/experiments/${id}/variants failed:`, err);
    return error('INTERNAL_ERROR', 'Failed to fetch variants', 500);
  }
}

/**
 * POST /api/v1/experiments/[id]/variants
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot add variants');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`experiment-variant-create:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  const { id } = await params;
  if (!isUUID(id)) return notFound('Experiment not found');

  try {
    const experiment = await ctx.db.experiment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!experiment) return notFound('Experiment not found');

    if (experiment.status !== 'draft') {
      return error('VALIDATION_ERROR', 'Can only add variants to draft experiments', 400);
    }

    const body = await req.json();
    const parsed = CreateVariantSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    const variant = await ctx.db.experimentVariant.create({
      data: {
        experimentId: id,
        label: parsed.data.label,
        trafficPercent: parsed.data.trafficPercent,
        presetOverrides: (parsed.data.presetOverrides ?? {}) as any,
        contentId: parsed.data.contentId,
      },
    });

    return success({
      ...variant,
      engagementRate: Number(variant.engagementRate),
      completionRate: Number(variant.completionRate),
      shareRate: Number(variant.shareRate),
    });
  } catch (err) {
    console.error(`POST /api/v1/experiments/${id}/variants failed:`, err);
    return error('INTERNAL_ERROR', 'Failed to add variant', 500);
  }
}
