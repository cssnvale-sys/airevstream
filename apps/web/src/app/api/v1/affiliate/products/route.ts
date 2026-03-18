import { authenticate, success, error, paginated, parseQuery, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

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

  try {
    const body = await req.json();
    const { name, url, salesAngle, commissionRate, category, description, brand, imageUrl } = body;

    if (!name || !url) {
      return validationError('name and url are required');
    }

    const product = await ctx.db.affiliateProduct.create({
      data: {
        name,
        url,
        salesAngle: salesAngle ?? null,
        commissionRate: commissionRate ?? null,
        category: category ?? null,
        description: description ?? null,
        brand: brand ?? null,
        imageUrl: imageUrl ?? null,
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
