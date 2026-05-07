import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticate,
  success,
  error,
  notFound,
  forbidden,
  isUUID,
  validationError,
  formatZodErrors,
} from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/experiments/[id]/declare-winner
 *
 * Manually declare the winning variant for an experiment and mark the
 * experiment `completed`. Complements the automated evaluate worker — some
 * experiments need operator judgement (small sample size, qualitative
 * trade-offs) and the dashboard had no way to surface that decision.
 *
 * Rules:
 *  - Only experiments in `running`, `evaluating`, or `stopped` status may
 *    have a winner declared.
 *  - The winning variant must belong to this experiment.
 *  - Once completed the row is immutable through this endpoint; subsequent
 *    calls return 409.
 */
const DeclareWinnerSchema = z.object({
  variantId: z.string().uuid(),
  notes: z.string().max(2000).optional().nullable(),
});

type RouteParams = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot declare winners');
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`experiment-declare-winner:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  const { id } = params;
  if (!isUUID(id)) return notFound('Experiment not found');

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = DeclareWinnerSchema.safeParse(body);
    if (!parsed.success) return validationError(formatZodErrors(parsed.error.errors));
    const { variantId, notes } = parsed.data;

    // Atomic: verify experiment + variant ownership, then mark completed.
    const updated = await ctx.db.$transaction(async (tx) => {
      const experiment = await tx.experiment.findFirst({
        where: { id, tenantId: ctx.tenantId! },
        include: { variants: { select: { id: true } } },
      });
      if (!experiment) return null;

      if (experiment.status === 'completed') {
        return { conflict: 'already_completed' as const };
      }
      if (!['running', 'evaluating', 'stopped'].includes(experiment.status)) {
        return { conflict: 'bad_status' as const, status: experiment.status };
      }

      const variantBelongs = experiment.variants.some((v) => v.id === variantId);
      if (!variantBelongs) return { conflict: 'variant_mismatch' as const };

      const result = await tx.experiment.update({
        where: { id },
        data: {
          status: 'completed',
          winnerId: variantId,
          endedAt: experiment.endedAt ?? new Date(),
          config: {
            ...(typeof experiment.config === 'object' && experiment.config ? experiment.config : {}),
            declaredWinner: {
              variantId,
              declaredBy: ctx.userId,
              declaredAt: new Date().toISOString(),
              notes: notes ?? null,
            },
          } as any,
        },
        include: { variants: true },
      });

      return { result };
    });

    if (!updated) return notFound('Experiment not found');
    if ('conflict' in updated) {
      if (updated.conflict === 'already_completed') {
        return error('CONFLICT', 'Experiment is already completed', 409);
      }
      if (updated.conflict === 'variant_mismatch') {
        return error('VALIDATION_ERROR', 'Variant does not belong to this experiment', 400);
      }
      return error('VALIDATION_ERROR', 'Experiment cannot have a winner declared in its current state', 400);
    }

    const exp = updated.result;
    return success({
      ...exp,
      confidenceLevel: Number(exp.confidenceLevel),
      significance: exp.significance != null ? Number(exp.significance) : null,
      variants: exp.variants.map((v) => ({
        ...v,
        engagementRate: Number(v.engagementRate),
        completionRate: Number(v.completionRate),
        shareRate: Number(v.shareRate),
      })),
    });
  } catch (err) {
    logger.error('POST /api/v1/experiments/[id]/declare-winner failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to declare winner', 500);
  }
}
