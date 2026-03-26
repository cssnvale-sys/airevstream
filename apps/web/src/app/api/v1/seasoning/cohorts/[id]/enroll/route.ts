import { authenticate, success, error, notFound, validationError, forbidden, isUUID } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { startSeasoningPipeline } from '@airevstream/queue';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const EnrollSchema = z.object({
  emailAccountIds: z.array(z.string().uuid()).min(1).max(100),
  platforms: z.array(z.enum(['youtube', 'tiktok', 'instagram', 'facebook'])).min(1).optional(),
  staggerMinutes: z.object({
    min: z.number().min(0).max(60),
    max: z.number().min(0).max(120),
  }).optional(),
});

/**
 * POST /api/v1/seasoning/cohorts/[id]/enroll
 * Enroll email accounts into the seasoning pipeline
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot enroll accounts');

  const { id } = params;
  if (!isUUID(id)) return notFound('Cohort not found');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`seasoning-enroll:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  try {
    const body = await req.json();
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    // Verify cohort exists and belongs to tenant
    const cohort = await ctx.db.seasoningCohort.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!cohort) return notFound('Cohort not found');

    // Verify all email accounts belong to tenant
    const accounts = await ctx.db.emailAccount.findMany({
      where: {
        id: { in: parsed.data.emailAccountIds },
        tenantId: ctx.tenantId,
      },
      select: { id: true },
    });

    if (accounts.length !== parsed.data.emailAccountIds.length) {
      return validationError('One or more email accounts not found or not owned by this tenant');
    }

    const platforms = parsed.data.platforms ?? cohort.platforms;

    // Update cohort to enrolling status
    await ctx.db.seasoningCohort.update({
      where: { id },
      data: {
        status: 'enrolling',
        startedAt: cohort.startedAt ?? new Date(),
      },
    });

    // Start the seasoning pipeline
    const result = await startSeasoningPipeline({
      cohortId: id,
      tenantId: ctx.tenantId,
      emailAccountIds: parsed.data.emailAccountIds,
      platforms,
      staggerMinutes: parsed.data.staggerMinutes,
    });

    return success({
      cohortId: id,
      enrolled: result.succeeded,
      failed: result.failed,
      totalJobs: result.totalJobs,
    });
  } catch (err) {
    console.error('POST /api/v1/seasoning/cohorts/[id]/enroll failed:', err);
    return error('INTERNAL_ERROR', 'Failed to enroll accounts', 500);
  }
}
