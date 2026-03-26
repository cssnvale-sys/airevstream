import { authenticate, success, error, paginated, parseQuery, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateCohortSchema = z.object({
  name: z.string().min(1).max(255),
  platforms: z.array(z.enum(['youtube', 'tiktok', 'instagram', 'facebook'])).min(1),
  scheduleConfig: z.record(z.unknown()).optional(),
  proxyConfig: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/seasoning/cohorts
 * List seasoning cohorts (paginated)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { page, limit, skip, sort, order, search, params } = parseQuery(req);
  const status = params.get('status') ?? undefined;

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const where: Record<string, unknown> = { tenantId: ctx.tenantId };
    if (status) where.status = status;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [cohorts, total] = await Promise.all([
      ctx.db.seasoningCohort.findMany({
        where,
        orderBy: { [sort === 'name' ? 'name' : 'createdAt']: order },
        skip,
        take: limit,
        include: {
          _count: { select: { enrollments: true } },
        },
      }),
      ctx.db.seasoningCohort.count({ where }),
    ]);

    return paginated(cohorts, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/seasoning/cohorts failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch cohorts', 500);
  }
}

/**
 * POST /api/v1/seasoning/cohorts
 * Create a new seasoning cohort
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot create cohorts');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`seasoning-cohort-create:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  try {
    const body = await req.json();
    const parsed = CreateCohortSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const cohort = await ctx.db.seasoningCohort.create({
      data: {
        tenantId: ctx.tenantId,
        name: parsed.data.name,
        platforms: parsed.data.platforms,
        scheduleConfig: (parsed.data.scheduleConfig ?? {}) as any,
        proxyConfig: (parsed.data.proxyConfig ?? {}) as any,
        status: 'pending',
      },
    });

    return success(cohort);
  } catch (err) {
    console.error('POST /api/v1/seasoning/cohorts failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create cohort', 500);
  }
}
