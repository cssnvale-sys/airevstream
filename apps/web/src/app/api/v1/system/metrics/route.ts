import { authenticate, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/system/metrics
 * System metrics (latest CPU, RAM, disk, queue depth, etc.).
 * Query: type? (filter by metric type), limit? (number of recent entries per type)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const url = new URL(req.url);
    const metricType = url.searchParams.get('type') ?? undefined;
    const historyLimit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '1')));

    if (metricType) {
      // Get history for a specific metric type
      const metrics = await ctx.db.systemMetric.findMany({
        where: { metricType },
        orderBy: { createdAt: 'desc' },
        take: historyLimit,
      });

      return success({
        metricType,
        entries: metrics.map(m => ({ ...m, value: Number(m.value) })),
      });
    }

    // Get latest value for each metric type
    const allTypes = ['cpu', 'ram', 'disk', 'network', 'queue_depth', 'sessions'];
    const latest: Record<string, unknown> = {};

    for (const type of allTypes) {
      const metrics = await ctx.db.systemMetric.findMany({
        where: { metricType: type },
        orderBy: { createdAt: 'desc' },
        take: historyLimit,
      });

      if (metrics.length > 0) {
        latest[type] = historyLimit === 1
          ? { value: Number(metrics[0].value), unit: metrics[0].unit, timestamp: metrics[0].createdAt }
          : metrics.map(m => ({ ...m, value: Number(m.value) }));
      }
    }

    // Also return flat values for dashboard consumption
    const flat: Record<string, number> = {};
    for (const [key, val] of Object.entries(latest)) {
      if (val && typeof val === 'object' && 'value' in (val as any)) {
        const camelKey = key === 'queue_depth' ? 'queueDepth' : key;
        flat[camelKey] = Number((val as any).value);
      }
    }

    return success({ ...flat, metrics: latest });
  } catch (err) {
    console.error('GET /api/v1/system/metrics error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch system metrics', 500);
  }
}
