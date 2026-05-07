import { authenticate, success, error, notFound, validationError, forbidden, isUUID } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const UpdateEnrollmentSchema = z.object({
  status: z.enum(['paused', 'phase_1', 'phase_2', 'phase_3', 'phase_4', 'failed']).optional(),
  failureReason: z.string().max(500).optional().nullable(),
});

/**
 * GET /api/v1/seasoning/enrollments/[id]
 * Get enrollment detail with full activity log
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = params;
  if (!isUUID(id)) return notFound('Enrollment not found');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const enrollment = await ctx.db.seasoningEnrollment.findUnique({
      where: { id },
      include: {
        emailAccount: { select: { id: true, email: true } },
        socialAccount: { select: { id: true, username: true, healthScore: true, status: true, platform: true } },
        cohort: {
          select: {
            id: true, name: true, tenantId: true,
          },
        },
      },
    });

    if (!enrollment) return notFound('Enrollment not found');

    // Tenant scoping — unconditional guard (D071)
    if (enrollment.cohort.tenantId !== ctx.tenantId) {
      return notFound('Enrollment not found');
    }

    return success(enrollment);
  } catch (err) {
    logger.error('GET /api/v1/seasoning/enrollments/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch enrollment', 500);
  }
}

/**
 * PUT /api/v1/seasoning/enrollments/[id]
 * Update enrollment (pause, resume, retry, manual phase set)
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot update enrollments');

  const { id } = params;
  if (!isUUID(id)) return notFound('Enrollment not found');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`seasoning-enrollment-update:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const body = await req.json();
    const parsed = UpdateEnrollmentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    // Verify enrollment belongs to tenant (unconditional guard — D071)
    const existing = await ctx.db.seasoningEnrollment.findUnique({
      where: { id },
      include: { cohort: { select: { tenantId: true } } },
    });

    if (!existing) return notFound('Enrollment not found');
    if (existing.cohort.tenantId !== ctx.tenantId) {
      return notFound('Enrollment not found');
    }

    const data: Record<string, unknown> = {};

    if (parsed.data.status) {
      data.status = parsed.data.status;

      // If resuming from paused/needs_human, set phase start
      if (['phase_1', 'phase_2', 'phase_3', 'phase_4'].includes(parsed.data.status)) {
        data.currentPhase = parsed.data.status;
        data.phaseStartedAt = new Date();
        data.failureReason = null;
      }

      // If retrying from failed, reset failures and restart
      if (existing.status === 'failed' && parsed.data.status !== 'failed') {
        data.failureCount = 0;
        data.failureReason = null;
      }
    }

    if (parsed.data.failureReason !== undefined) {
      data.failureReason = parsed.data.failureReason;
    }

    const updated = await ctx.db.seasoningEnrollment.update({
      where: { id },
      data,
    });

    return success(updated);
  } catch (err) {
    logger.error('PUT /api/v1/seasoning/enrollments/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update enrollment', 500);
  }
}
