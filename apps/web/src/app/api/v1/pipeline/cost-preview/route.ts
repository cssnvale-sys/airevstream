import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { estimateFromResolvedConfig } from '@airevstream/shared';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return error('FORBIDDEN', 'Viewers cannot preview costs', 403);
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`pipeline-cost-preview:POST:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const body = await req.json();

    const { shots, qualityTier, provider } = body as {
      shots?: Array<{ duration?: number; outputType?: string; generation?: { width?: number; height?: number } }>;
      qualityTier?: 'draft' | 'standard' | 'cinema';
      provider?: string;
    };

    if (!shots || !Array.isArray(shots) || shots.length === 0) {
      return error('VALIDATION_ERROR', 'shots array is required and must not be empty', 400);
    }

    const estimate = estimateFromResolvedConfig(shots, {
      provider: provider ?? 'comfyui',
      qualityTier: qualityTier ?? 'standard',
    });

    // No budget model in schema — return static values
    return success({
      estimate,
      budget: {
        remaining: null,
        status: 'ok',
        exceeded: false,
      },
    });
  } catch (err) {
    logger.error('POST /api/v1/pipeline/cost-preview failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to estimate cost', 500);
  }
}
