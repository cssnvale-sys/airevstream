import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, paginated, parseQuery, validationError, forbidden , type ApiContext} from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const createScenerySchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().max(50).optional().nullable(),
  imageUrl: z.string().min(1),
  prompt: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

/**
 * GET /api/v1/scenery
 * List scenery assets (paginated, filterable by category, searchable by name).
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { page, limit, skip, sort, order, search, params } = parseQuery(req);

    const category = params.get('category') ?? undefined;

    const where: Record<string, unknown> = { tenantId: ctx.tenantId };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'category'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [sceneryAssets, total] = await Promise.all([
      ctx.db.sceneryAsset.findMany({
        where: where as any,
        include: {
          _count: { select: { channelScenery: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.sceneryAsset.count({ where: where as any }),
    ]);

    const data = sceneryAssets.map(({ _count, ...asset }: { _count: unknown; [key: string]: unknown }) => ({
      ...asset,
      channelCount: (_count as { channelScenery: number }).channelScenery,
    }));

    return paginated(data, total, page, limit);
  } catch (err) {
    logger.error('GET /api/v1/scenery error:', err as Error, { userId: ctx && !(ctx instanceof NextResponse) ? (ctx as ApiContext).userId : undefined });
    return error('INTERNAL_ERROR', 'Failed to fetch scenery assets', 500);
  }
}

/**
 * POST /api/v1/scenery
 * Create a scenery asset.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`scenery:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = createScenerySchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { name, category, imageUrl, prompt, metadata } = parsed.data;

    const scenery = await ctx.db.sceneryAsset.create({
      data: {
        tenantId: ctx.tenantId!,
        name,
        category: category ?? null,
        imageUrl,
        prompt: prompt ?? null,
        metadata: metadata as any,
      },
    });

    return success(scenery);
  } catch (err) {
    logger.error('POST /api/v1/scenery error:', err as Error, { userId: ctx && !(ctx instanceof NextResponse) ? (ctx as ApiContext).userId : undefined });
    return error('INTERNAL_ERROR', 'Failed to create scenery asset', 500);
  }
}
