import { authenticate, error, json } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/system/health
 * System health summary. Requires authentication.
 * Returns latest metrics, service counts, queue depth.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    // Latest metrics by type
    const metricTypes = ['cpu', 'ram', 'disk', 'queue_depth'];
    const latestMetrics: Record<string, unknown> = {};

    for (const metricType of metricTypes) {
      const metric = await ctx.db.systemMetric.findFirst({
        where: { metricType },
        orderBy: { createdAt: 'desc' },
      });
      latestMetrics[metricType] = metric
        ? { value: metric.value, unit: metric.unit, timestamp: metric.createdAt }
        : null;
    }

    // Service status counts
    const serviceStatuses = await ctx.db.aiService.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const totalServices = serviceStatuses.reduce((sum, s) => sum + s._count.id, 0);
    const healthyServices = serviceStatuses.find((s) => s.status === 'active')?._count.id ?? 0;

    // Active alerts count
    const alertCounts = await ctx.db.alert.groupBy({
      by: ['severity'],
      where: { status: 'open' },
      _count: { id: true },
    });

    // Active workflow jobs
    const activeJobs = await ctx.db.workflowJob.count({
      where: { status: { in: ['queued', 'running'] } },
    });

    // Scheduled posts pending
    const pendingPosts = await ctx.db.scheduledPost.count({
      where: { status: 'scheduled' },
    });

    return json({
      success: true,
      data: {
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
      },
    });
  } catch (err) {
    console.error('GET /api/v1/system/health error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch system health', 500);
  }
}
