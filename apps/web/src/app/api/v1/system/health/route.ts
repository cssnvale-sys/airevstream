import { authenticateAny, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Check an external service with a timeout.
 * Returns { status: 'up' | 'down' | 'unknown', latencyMs, lastChecked, error? }
 */
async function checkService(
  name: string,
  url: string,
  timeoutMs = 5000,
): Promise<{ name: string; status: 'up' | 'down' | 'unknown'; latencyMs: number; lastChecked: string; error?: string }> {
  const lastChecked = new Date().toISOString();
  if (!url) return { name, status: 'unknown', latencyMs: 0, lastChecked, error: 'URL not configured' };

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return { name, status: res.ok ? 'up' : 'down', latencyMs: Date.now() - start, lastChecked };
  } catch (err) {
    console.error(`Health check failed for ${name}:`, err);
    return { name, status: 'down', latencyMs: Date.now() - start, lastChecked, error: 'Connection failed' };
  }
}

/**
 * GET /api/v1/system/health
 * System health summary. Requires authentication.
 * Returns latest metrics, service counts, queue depth, and infrastructure checks.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;

  try {
    // Parallel: fetch all metrics, service statuses, alerts, jobs, and posts at once
    const metricTypes = ['cpu', 'ram', 'disk', 'network', 'queue_depth', 'sessions'];

    // Pre-fetch tenant channel + account IDs for scoping WorkflowJob and ScheduledPost
    const [tenantChannels, tenantAccounts] = await Promise.all([
      ctx.db.channel.findMany({
        where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
        select: { id: true },
      }),
      ctx.db.emailAccount.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true },
      }),
    ]);
    const tenantChannelIds = tenantChannels.map((c) => c.id);
    const tenantAccountIds = tenantAccounts.map((a) => a.id);

    // External service health checks (non-blocking — don't fail the endpoint)
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const comfyuiUrl = process.env.COMFYUI_URL || 'http://localhost:8188';
    const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const minioPort = process.env.MINIO_PORT || '9000';
    const minioUrl = `http://${minioEndpoint}:${minioPort}/minio/health/live`;

    const [allMetrics, serviceStatuses, alertCounts, activeJobs, pendingPosts, ollamaCheck, comfyuiCheck, minioCheck] = await Promise.all([
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
        where: { status: 'open', OR: [{ tenantId: ctx.tenantId }, { tenantId: null }] },
        _count: { id: true },
      }),
      ctx.db.workflowJob.count({
        where: {
          status: { in: ['queued', 'running'] },
          OR: [
            { channelId: { in: tenantChannelIds } },
            { emailAccountId: { in: tenantAccountIds } },
          ],
        },
      }),
      ctx.db.scheduledPost.count({
        where: {
          status: 'scheduled',
          channelId: { in: tenantChannelIds },
        },
      }),
      checkService('ollama', `${ollamaUrl}/api/tags`, 3000),
      checkService('comfyui', `${comfyuiUrl}/system_stats`, 3000),
      checkService('minio', minioUrl, 3000),
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

    // Determine overall status: healthy if DB + all infra up, degraded if partial, unhealthy if DB down
    const infraChecks = [ollamaCheck, comfyuiCheck, minioCheck];
    const infraDown = infraChecks.filter(c => c.status === 'down').length;
    let overallStatus: string;
    if (totalServices === 0 && infraDown === infraChecks.length) {
      overallStatus = 'unhealthy';
    } else if (infraDown > 0 || healthyServices < totalServices) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return success({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      metrics: latestMetrics,
      services: {
        total: totalServices,
        healthy: healthyServices,
        statuses: Object.fromEntries(serviceStatuses.map((s) => [s.status, s._count.id])),
      },
      infrastructure: {
        ollama: ollamaCheck,
        comfyui: comfyuiCheck,
        minio: minioCheck,
        database: { name: 'postgresql', status: 'up', lastChecked: new Date().toISOString(), latencyMs: 0 },
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
