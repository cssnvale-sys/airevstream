import { authenticateAny, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/system/health
 * System health summary. Requires authentication.
 * Returns latest metrics, service counts, queue depth.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;

  try {
    // Parallel: fetch all metrics, service statuses, alerts, jobs, and posts at once
    const metricTypes = ['cpu', 'ram', 'disk', 'queue_depth'];

    const [allMetrics, serviceStatuses, alertCounts, activeJobs, pendingPosts] = await Promise.all([
      ctx.db.systemMetric.findMany({
        where: { metricType: { in: metricTypes } },
        orderBy: { createdAt: 'desc' },
      }),
      ctx.db.aiService.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      ctx.db.alert.groupBy({
        by: ['severity'],
        where: { status: 'open' },
        _count: { id: true },
      }),
      ctx.db.workflowJob.count({
        where: { status: { in: ['queued', 'running'] } },
      }),
      ctx.db.scheduledPost.count({
        where: { status: 'scheduled' },
      }),
    ]);

    // Group metrics by type and take the latest per type
    const latestMetrics: Record<string, unknown> = {};
    for (const metricType of metricTypes) {
      const metric = allMetrics.find(m => m.metricType === metricType);
      latestMetrics[metricType] = metric
        ? { value: Number(metric.value), unit: metric.unit, timestamp: metric.createdAt }
        : null;
    }

    const totalServices = serviceStatuses.reduce((sum, s) => sum + s._count.id, 0);
    const healthyServices = serviceStatuses.find((s) => s.status === 'active')?._count.id ?? 0;

    return success({
      status: totalServices === 0 ? 'unknown' : (healthyServices === totalServices ? 'healthy' : 'degraded'),
      timestamp: new Date().toISOString(),
      metrics: latestMetrics,
      services: {
        total: totalServices,
        healthy: healthyServices,
        statuses: Object.fromEntries(serviceStatuses.map((s) => [s.status, s._count.id])),
      },
      alerts: {
        open: Object.fromEntries(alertCounts.map((a) => [a.severity, a._count.id])),
      },
      queues: {
        activeJobs,
        pendingPosts,
      },
    });
  } catch (err) {
    console.error('GET /api/v1/system/health error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch system health', 500);
  }
}
