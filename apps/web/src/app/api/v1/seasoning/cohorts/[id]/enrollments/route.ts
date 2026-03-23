import { authenticate, success, error, notFound, paginated, parseQuery, isUUID } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/seasoning/cohorts/[id]/enrollments
 * List enrollments for a cohort (filterable by status, platform, phase)
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = params;
  if (!isUUID(id)) return notFound('Cohort not found');

  const { page, limit, skip, params: searchParams } = parseQuery(req);
  const status = searchParams.get('status') ?? undefined;
  const platform = searchParams.get('platform') ?? undefined;
  const phase = searchParams.get('phase') ?? undefined;

  try {
    // Verify cohort belongs to tenant
    const cohort = await ctx.db.seasoningCohort.findFirst({
      where: { id, ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}) },
      select: { id: true },
    });
    if (!cohort) return notFound('Cohort not found');

    const where: Record<string, unknown> = { cohortId: id };
    if (status) where.status = status;
    if (platform) where.platform = platform;
    if (phase) where.currentPhase = phase;

    const [enrollments, total] = await Promise.all([
      ctx.db.seasoningEnrollment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          emailAccount: { select: { id: true, email: true } },
          socialAccount: { select: { id: true, username: true, healthScore: true, status: true } },
        },
      }),
      ctx.db.seasoningEnrollment.count({ where }),
    ]);

    return paginated(enrollments, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/seasoning/cohorts/[id]/enrollments failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch enrollments', 500);
  }
}
