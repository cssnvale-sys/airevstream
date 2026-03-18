import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/affiliate/products/[id]
 * Get affiliate product detail with channel pools.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const product = await ctx.db.affiliateProduct.findUnique({
      where: { id },
      include: {
        channelPools: {
          include: {
            channel: { select: { id: true, name: true } },
          },
        },
        _count: { select: { clicks: true, contentItems: true } },
      },
    });

    if (!product) return notFound('Affiliate product not found');

    return success(product);
  } catch (err) {
    console.error('GET /api/v1/affiliate/products/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch affiliate product', 500);
  }
}

/**
 * PUT /api/v1/affiliate/products/[id]
 * Update an affiliate product.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const existing = await ctx.db.affiliateProduct.findUnique({ where: { id } });
    if (!existing) return notFound('Affiliate product not found');

    const body = await req.json();
    const { name, url, shortUrl, salesAngle, commissionRate, category, description, brand, imageUrl, status } = body;

    const validStatuses = ['active', 'inactive', 'expired'];
    if (status && !validStatuses.includes(status)) {
      return validationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (url !== undefined) data.url = url;
    if (shortUrl !== undefined) data.shortUrl = shortUrl;
    if (salesAngle !== undefined) data.salesAngle = salesAngle;
    if (commissionRate !== undefined) data.commissionRate = commissionRate;
    if (category !== undefined) data.category = category;
    if (description !== undefined) data.description = description;
    if (brand !== undefined) data.brand = brand;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (status !== undefined) data.status = status;

    const updated = await ctx.db.affiliateProduct.update({
      where: { id },
      data,
    });

    return success(updated);
  } catch (err) {
    console.error('PUT /api/v1/affiliate/products/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to update affiliate product', 500);
  }
}
