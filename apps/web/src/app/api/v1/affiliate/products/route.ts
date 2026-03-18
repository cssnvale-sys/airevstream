import { authenticate, success, error, paginated, parseQuery, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  salesAngle: z.string().max(500).optional().nullable(),
  commissionRate: z.number().min(0).max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  brand: z.string().max(200).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
}).strict();

/**
 * GET /api/v1/affiliate/products
 * List affiliate products (paginated, filterable by category, status, search).
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, sort, order, search, params } = parseQuery(req);
    const category = params.get('category') ?? undefined;
    const status = params.get('status') ?? undefined;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { salesAngle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSorts = ['createdAt', 'name', 'totalClicks', 'totalConversions', 'totalRevenue', 'commissionRate'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [rawItems, total] = await Promise.all([
      ctx.db.affiliateProduct.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
        include: {
          _count: { select: { channelPools: true, clicks: true } },
        },
      }),
      ctx.db.affiliateProduct.count({ where }),
    ]);

    // Convert Prisma Decimal fields to numbers for JSON serialization
    const items = rawItems.map((item) => ({
      ...item,
      commissionRate: item.commissionRate != null ? Number(item.commissionRate) : null,
      totalRevenue: Number(item.totalRevenue),
    }));

    return paginated(items, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/affiliate/products error:', err);
    return error('INTERNAL_ERROR', 'Failed to list affiliate products', 500);
  }
}

/**
 * POST /api/v1/affiliate/products
 * Add a new affiliate product.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`affiliate/products:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const product = await ctx.db.affiliateProduct.create({
      data: {
        name: parsed.data.name,
        url: parsed.data.url,
        salesAngle: parsed.data.salesAngle ?? null,
        commissionRate: parsed.data.commissionRate ?? null,
        category: parsed.data.category ?? null,
        description: parsed.data.description ?? null,
        brand: parsed.data.brand ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
      },
    });

    return success({
      ...product,
      commissionRate: product.commissionRate != null ? Number(product.commissionRate) : null,
      totalRevenue: Number(product.totalRevenue),
    });
  } catch (err) {
    console.error('POST /api/v1/affiliate/products error:', err);
    return error('INTERNAL_ERROR', 'Failed to create affiliate product', 500);
  }
}
