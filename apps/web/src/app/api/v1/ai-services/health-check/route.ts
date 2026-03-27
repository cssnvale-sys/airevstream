import { authenticate, success, error, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Block SSRF by rejecting URLs targeting private/loopback addresses */
function isPrivateUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname;
    // Block loopback, link-local, RFC1918, and metadata endpoints
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^fc[0-9a-f]{2}:/i.test(hostname) ||
      /^fd[0-9a-f]{2}:/i.test(hostname) ||
      /^fe80:/i.test(hostname)
    ) {
      // Allow localhost ONLY for Ollama (local AI) endpoints
      if ((hostname === 'localhost' || hostname === '127.0.0.1') &&
          (parsed.port === '11434' || parsed.port === '11435')) {
        return false;
      }
      return true;
    }
    // Block non-http(s) schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }
    return false;
  } catch (err) {
    console.error('isPrivateUrl: malformed URL, treating as private:', err);
    return true;
  }
}

/**
 * POST /api/v1/ai-services/health-check
 * Trigger health check for all active AI services.
 * Actually pings each service endpoint to verify connectivity.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can trigger health checks');
  }

  const rl = checkRateLimit(`health-check:${getClientIp(req)}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many requests', 429);
  }

  try {
    const services = await ctx.db.aiService.findMany({
      where: { status: { not: 'disabled' } },
      select: { id: true, name: true, provider: true, endpoint: true, status: true, isLocal: true },
    });

    const now = new Date();

    // Parallelize all health checks with Promise.allSettled
    const checkResults = await Promise.allSettled(
      services.map(async (service) => {
        let healthy = false;
        let responseMs: number | null = null;
        let errorMsg: string | null = null;

        // Determine the health check URL based on provider
        let healthUrl: string | null = null;
        if (service.provider === 'ollama') {
          healthUrl = `${service.endpoint ?? 'http://localhost:11434'}/api/tags`;
        } else if (service.endpoint) {
          healthUrl = service.endpoint;
        }

        if (!healthUrl) {
          healthy = service.status === 'active';
          return { service, healthy, responseMs: null, errorMsg: null, status: healthy ? 'active' : service.status };
        }

        // SSRF protection
        if (isPrivateUrl(healthUrl)) {
          return { service, healthy: false, responseMs: null, errorMsg: 'Blocked: endpoint points to private/internal address', status: 'down' };
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
          console.error('Health check fetch failed for', healthUrl, fetchErr);
          errorMsg = fetchErr instanceof Error && fetchErr.name === 'AbortError' ? 'Timeout (5s)' : 'Connection failed';
          healthy = false;
        }

        return { service, healthy, responseMs, errorMsg, status: healthy ? 'active' : 'down' };
      }),
    );

    // Collect results and batch DB updates in a transaction
    const results: Array<Record<string, unknown>> = [];
    const dbUpdates = [];

    for (const settled of checkResults) {
      if (settled.status === 'rejected') continue;
      const { service, healthy, responseMs, errorMsg, status: newStatus } = settled.value;

      results.push({
        id: service.id,
        name: service.name,
        provider: service.provider,
        status: newStatus,
        checkedAt: now.toISOString(),
        healthy,
        responseMs,
        ...(errorMsg ? { error: errorMsg } : {}),
      });

      dbUpdates.push(
        ctx.db.aiService.update({
          where: { id: service.id },
          data: {
            lastHealthCheck: now,
            status: newStatus,
            ...(responseMs != null ? { avgResponseMs: responseMs } : {}),
            healthScore: healthy ? 100 : 0,
          },
        }),
      );
    }

    // Batch all DB updates in one transaction
    if (dbUpdates.length > 0) {
      await ctx.db.$transaction(dbUpdates);
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
