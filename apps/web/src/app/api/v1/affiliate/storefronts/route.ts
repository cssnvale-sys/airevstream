import { authenticate, success, error, paginated, parseQuery, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createStorefrontSchema = z.object({
  channelId: z.string().uuid('channelId must be a valid UUID'),
  name: z.string().min(1, 'name is required').max(255),
  slug: z.string().min(1, 'slug is required').max(100).regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'slug must be lowercase alphanumeric with hyphens only'
  ),
  description: z.string().nullish(),
  logoUrl: z.string().url().nullish(),
  bannerUrl: z.string().url().nullish(),
  theme: z.record(z.unknown()).optional().default({}),
  customDomain: z.string().max(255).nullish(),
});

/**
 * GET /api/v1/affiliate/storefronts
 * List storefronts with optional channelId and status filters, pagination.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, sort, order, search, params } = parseQuery(req);
    const channelId = params.get('channelId') ?? undefined;
    const status = params.get('status') ?? undefined;

    const where: Record<string, unknown> = {};
    if (channelId) where.channelId = channelId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSorts = ['createdAt', 'name', 'slug', 'status'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      ctx.db.storefront.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
        include: {
          _count: { select: { products: true } },
        },
      }),
      ctx.db.storefront.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/affiliate/storefronts error:', err);
    return error('INTERNAL_ERROR', 'Failed to list storefronts', 500);
  }
}

/**
 * POST /api/v1/affiliate/storefronts
 * Create a new storefront.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = createStorefrontSchema.safeParse(body);

    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => e.message).join('; ');
      return validationError(messages);
    }

    const { channelId, name, slug, description, logoUrl, bannerUrl, theme, customDomain } = parsed.data;

    // Check slug uniqueness
    const existing = await ctx.db.storefront.findUnique({ where: { slug } });
    if (existing) {
      return validationError('A storefront with this slug already exists');
    }

    const storefront = await ctx.db.storefront.create({
      data: {
        channelId,
        name,
        slug,
        description: description ?? null,
        logoUrl: logoUrl ?? null,
        bannerUrl: bannerUrl ?? null,
        theme: (theme ?? {}) as any,
        customDomain: customDomain ?? null,
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    return success(storefront);
  } catch (err) {
    console.error('POST /api/v1/affiliate/storefronts error:', err);
    return error('INTERNAL_ERROR', 'Failed to create storefront', 500);
  }
}
