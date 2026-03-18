import { authenticate, success, error } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/ai-services/health-check
 * Trigger health check for all active AI services.
 * Actually pings each service endpoint to verify connectivity.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const services = await ctx.db.aiService.findMany({
      where: { status: { not: 'disabled' } },
      select: { id: true, name: true, provider: true, endpoint: true, status: true, isLocal: true },
    });

    const now = new Date();
    const results = [];

    for (const service of services) {
      let healthy = false;
      let responseMs: number | null = null;
      let errorMsg: string | null = null;

      try {
        // Determine the health check URL based on provider
        let healthUrl: string;
        if (service.provider === 'ollama') {
          healthUrl = `${service.endpoint ?? 'http://localhost:11434'}/api/tags`;
        } else if (service.endpoint) {
          // For generic endpoints, try a simple GET
          healthUrl = service.endpoint;
        } else {
          // No endpoint to ping — mark as unknown
          healthy = service.status === 'active';
          results.push({
            id: service.id,
            name: service.name,
            provider: service.provider,
            status: healthy ? 'active' : service.status,
            checkedAt: now.toISOString(),
            healthy,
            responseMs: null,
          });
          await ctx.db.aiService.update({
            where: { id: service.id },
            data: { lastHealthCheck: now },
          });
          continue;
        }

        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const res = await fetch(healthUrl, { signal: controller.signal });
          clearTimeout(timeout);
          responseMs = Date.now() - start;
          healthy = res.ok;
        } catch (fetchErr) {
          clearTimeout(timeout);
          errorMsg = fetchErr instanceof Error && fetchErr.name === 'AbortError' ? 'Timeout (5s)' : 'Connection failed';
          healthy = false;
        }
      } catch (err) {
        healthy = false;
        errorMsg = 'Health check setup failed';
      }

      const newStatus = healthy ? 'active' : 'down';
      await ctx.db.aiService.update({
        where: { id: service.id },
        data: {
          lastHealthCheck: now,
          status: newStatus,
          avgResponseMs: responseMs ?? undefined,
          healthScore: healthy ? 100 : 0,
        },
      });

      results.push({
        id: service.id,
        name: service.name,
        provider: service.provider,
        status: newStatus,
        checkedAt: now.toISOString(),
        healthy,
        responseMs,
        error: errorMsg,
      });
    }

    return success({
      checkedAt: now.toISOString(),
      servicesChecked: results.length,
      healthy: results.filter((r) => r.healthy).length,
      unhealthy: results.filter((r) => !r.healthy).length,
      results,
    });
  } catch (err) {
    console.error('POST /api/v1/ai-services/health-check error:', err);
    return error('INTERNAL_ERROR', 'Failed to run health checks', 500);
  }
}
