import { authenticate, success, error, paginated, parseQuery, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateExperimentSchema = z.object({
  name: z.string().min(1).max(255),
  hypothesis: z.string().min(1).max(2000).optional(),
  primaryMetric: z.enum(['views', 'engagement', 'retention', 'clickRate', 'viralScore']),
  confidenceLevel: z.number().min(0.80).max(0.99).optional(),
  minSampleSize: z.number().int().min(10).max(100000).optional(),
  variants: z.array(z.object({
    label: z.string().min(1).max(255),
    trafficPercent: z.number().int().min(1).max(99),
    presetOverrides: z.record(z.unknown()).optional(),
    contentId: z.string().uuid().optional(),
  })).min(2).max(10),
  config: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/experiments
 * List experiments (paginated, tenant-scoped)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { page, limit, skip, sort, order, search, params } = parseQuery(req);
  const status = params.get('status') ?? undefined;

  try {
    const where: Record<string, unknown> = { tenantId: ctx.tenantId };
    if (status) where.status = status;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [experiments, total] = await Promise.all([
      ctx.db.experiment.findMany({
        where,
        orderBy: { [sort === 'name' ? 'name' : 'createdAt']: order },
        skip,
        take: limit,
        include: {
          _count: { select: { variants: true } },
        },
      }),
      ctx.db.experiment.count({ where }),
    ]);

    const mapped = experiments.map(e => ({
      ...e,
      confidenceLevel: Number(e.confidenceLevel),
      significance: e.significance != null ? Number(e.significance) : null,
    }));

    return paginated(mapped, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/experiments failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch experiments', 500);
  }
}

/**
 * POST /api/v1/experiments
 * Create a new experiment
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot create experiments');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`experiment-create:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  try {
    const body = await req.json();
    const parsed = CreateExperimentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    const { variants, ...experimentData } = parsed.data;

    // Validate traffic sums to 100
    const totalTraffic = variants.reduce((sum, v) => sum + v.trafficPercent, 0);
    if (totalTraffic !== 100) {
      return validationError(`Traffic allocation must sum to 100% (currently ${totalTraffic}%)`);
    }

    const experiment = await ctx.db.experiment.create({
      data: {
        tenantId: ctx.tenantId,
        name: experimentData.name,
        hypothesis: experimentData.hypothesis,
        primaryMetric: experimentData.primaryMetric,
        confidenceLevel: experimentData.confidenceLevel ?? 0.95,
        minSampleSize: experimentData.minSampleSize ?? 100,
        config: (experimentData.config ?? {}) as any,
        variants: {
          create: variants.map(v => ({
            label: v.label,
            trafficPercent: v.trafficPercent,
            presetOverrides: (v.presetOverrides ?? {}) as any,
            contentId: v.contentId,
          })),
        },
      },
      include: {
        variants: true,
        _count: { select: { variants: true } },
      },
    });

    return success({
      ...experiment,
      confidenceLevel: Number(experiment.confidenceLevel),
      significance: experiment.significance != null ? Number(experiment.significance) : null,
      variants: experiment.variants.map(v => ({
        ...v,
        engagementRate: Number(v.engagementRate),
        completionRate: Number(v.completionRate),
        shareRate: Number(v.shareRate),
      })),
    });
  } catch (err) {
    console.error('POST /api/v1/experiments failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create experiment', 500);
  }
}
