import { authenticateAny, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/system/metrics
 * System metrics (latest CPU, RAM, disk, queue depth, etc.).
 * Query: type? (filter by metric type), limit? (number of recent entries per type)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const url = new URL(req.url);
    const validMetricTypes = ['cpu', 'ram', 'disk', 'network', 'queue_depth', 'sessions'];
    const rawType = url.searchParams.get('type') ?? undefined;
    const metricType = rawType && validMetricTypes.includes(rawType) ? rawType : undefined;
    const parsedLimit = parseInt(url.searchParams.get('limit') ?? '1', 10);
    const historyLimit = Math.min(100, Math.max(1, isNaN(parsedLimit) ? 1 : parsedLimit));

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

    // Fetch all metrics at once and group by type in JS
    const allMetrics = await ctx.db.systemMetric.findMany({
      where: { metricType: { in: validMetricTypes } },
      orderBy: { createdAt: 'desc' },
    });

    const latest: Record<string, unknown> = {};
    for (const type of validMetricTypes) {
      const typeMetrics = allMetrics.filter(m => m.metricType === type).slice(0, historyLimit);

      if (typeMetrics.length > 0) {
        latest[type] = historyLimit === 1
          ? { value: Number(typeMetrics[0].value), unit: typeMetrics[0].unit, timestamp: typeMetrics[0].createdAt }
          : typeMetrics.map(m => ({ ...m, value: Number(m.value) }));
      }
    }

    // Also return flat values for dashboard consumption
    const flat: Record<string, number> = {};
    for (const [key, val] of Object.entries(latest)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && 'value' in val) {
        const camelKey = key === 'queue_depth' ? 'queueDepth' : key;
        flat[camelKey] = Number((val as { value: unknown }).value);
      }
    }

    return success({ ...flat, metrics: latest });
  } catch (err) {
    console.error('GET /api/v1/system/metrics error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch system metrics', 500);
  }
}
