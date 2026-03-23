import { authenticate, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/seasoning/stats
 * Dashboard stats for the seasoning pipeline
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const tenantWhere = ctx.tenantId ? { tenantId: ctx.tenantId } : {};

    const [totalCohorts, activeCohorts, enrollmentsByStatus, enrollmentsByPlatform, graduatedRecent, failedRecent] = await Promise.all([
      ctx.db.seasoningCohort.count({ where: tenantWhere }),
      ctx.db.seasoningCohort.count({ where: { ...tenantWhere, status: { in: ['enrolling', 'active'] } } }),
      ctx.db.seasoningEnrollment.groupBy({
        by: ['status'],
        _count: true,
        where: { cohort: tenantWhere },
      }),
      ctx.db.seasoningEnrollment.groupBy({
        by: ['platform'],
        _count: true,
        where: { cohort: tenantWhere },
      }),
      ctx.db.seasoningEnrollment.count({
        where: {
          cohort: tenantWhere,
          status: 'graduated',
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      ctx.db.seasoningEnrollment.count({
        where: {
          cohort: tenantWhere,
          status: 'failed',
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of enrollmentsByStatus) {
      byStatus[row.status] = row._count;
    }

    const byPlatform: Record<string, number> = {};
    for (const row of enrollmentsByPlatform) {
      byPlatform[row.platform] = row._count;
    }

    const totalEnrollments = Object.values(byStatus).reduce((a, b) => a + b, 0);

    return success({
      totalCohorts,
      activeCohorts,
      totalEnrollments,
      byStatus,
      byPlatform,
      graduatedLast7Days: graduatedRecent,
      failedLast7Days: failedRecent,
    });
  } catch (err) {
    console.error('GET /api/v1/seasoning/stats failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch seasoning stats', 500);
  }
}
