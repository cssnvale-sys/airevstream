import { authenticate, success, error, notFound, validationError, forbidden, isUUID } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const UpdateCohortSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['pending', 'enrolling', 'active', 'paused', 'completed']).optional(),
  scheduleConfig: z.record(z.unknown()).optional(),
  proxyConfig: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/seasoning/cohorts/[id]
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return notFound('Cohort not found');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const cohort = await ctx.db.seasoningCohort.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        _count: { select: { enrollments: true } },
        enrollments: {
          select: { status: true },
        },
      },
    });

    if (!cohort) return notFound('Cohort not found');

    // Build phase counts
    const phaseCounts: Record<string, number> = {};
    for (const e of cohort.enrollments) {
      phaseCounts[e.status] = (phaseCounts[e.status] ?? 0) + 1;
    }

    const { enrollments: _enrollments, ...rest } = cohort;
    return success({ ...rest, phaseCounts });
  } catch (err) {
    logger.error('GET /api/v1/seasoning/cohorts/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch cohort', 500);
  }
}

/**
 * PUT /api/v1/seasoning/cohorts/[id]
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot update cohorts');

  const { id } = await params;
  if (!isUUID(id)) return notFound('Cohort not found');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`seasoning-cohort-update:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const body = await req.json();
    const parsed = UpdateCohortSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    const existing = await ctx.db.seasoningCohort.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return notFound('Cohort not found');

    const cohort = await ctx.db.seasoningCohort.update({
      where: { id },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.scheduleConfig && { scheduleConfig: parsed.data.scheduleConfig as any }),
        ...(parsed.data.proxyConfig && { proxyConfig: parsed.data.proxyConfig as any }),
      },
    });

    return success(cohort);
  } catch (err) {
    logger.error('PUT /api/v1/seasoning/cohorts/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update cohort', 500);
  }
}

/**
 * DELETE /api/v1/seasoning/cohorts/[id]
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot delete cohorts');

  const { id } = await params;
  if (!isUUID(id)) return notFound('Cohort not found');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`seasoning-cohort-delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const existing = await ctx.db.seasoningCohort.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return notFound('Cohort not found');

    await ctx.db.seasoningCohort.delete({ where: { id } });
    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/seasoning/cohorts/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete cohort', 500);
  }
}
