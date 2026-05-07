import { authenticate, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  url: z.string().url().max(2000).optional(),
  shortUrl: z.string().url().max(500).optional().nullable(),
  salesAngle: z.string().max(2000).optional().nullable(),
  commissionRate: z.number().min(0).max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  brand: z.string().max(200).optional().nullable(),
  imageUrl: z.string().url().max(2000).optional().nullable(),
  status: z.enum(['active', 'inactive', 'expired']).optional(),
});

/**
 * GET /api/v1/affiliate/products/[id]
 * Get affiliate product detail with channel pools.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

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

    // Verify tenant ownership via channel pool → channel → socialAccount → emailAccount chain
    const tenantPool = await ctx.db.channelAffiliatePool.findFirst({
      where: {
        affiliateProductId: id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { channelId: true },
    });
    if (!tenantPool) return notFound('Affiliate product not found');

    const converted = {
      ...product,
      commissionRate: product.commissionRate != null ? Number(product.commissionRate) : null,
      totalRevenue: Number(product.totalRevenue),
      channelPools: product.channelPools?.map(pool => ({
        ...pool,
        performanceScore: Number(pool.performanceScore),
      })),
    };

    return success(converted);
  } catch (err) {
    logger.error('GET /api/v1/affiliate/products/[id] error', err as Error);
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
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`affiliate/products/[id]:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const existing = await ctx.db.affiliateProduct.findUnique({ where: { id } });
    if (!existing) return notFound('Affiliate product not found');

    // Verify product is in a channel pool owned by this tenant
    const ownsProduct = await ctx.db.channelAffiliatePool.findFirst({
      where: {
        affiliateProductId: id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { channelId: true },
    });
    if (!ownsProduct) return notFound('Affiliate product not found');

    const body = await req.json();
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const fields = parsed.data;
    const data: Record<string, unknown> = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.url !== undefined) data.url = fields.url;
    if (fields.shortUrl !== undefined) data.shortUrl = fields.shortUrl;
    if (fields.salesAngle !== undefined) data.salesAngle = fields.salesAngle;
    if (fields.commissionRate !== undefined) data.commissionRate = fields.commissionRate;
    if (fields.category !== undefined) data.category = fields.category;
    if (fields.description !== undefined) data.description = fields.description;
    if (fields.brand !== undefined) data.brand = fields.brand;
    if (fields.imageUrl !== undefined) data.imageUrl = fields.imageUrl;
    if (fields.status !== undefined) data.status = fields.status;

    const updated = await ctx.db.affiliateProduct.update({
      where: { id },
      data,
    });

    const converted = {
      ...updated,
      commissionRate: updated.commissionRate != null ? Number(updated.commissionRate) : null,
      totalRevenue: Number(updated.totalRevenue),
    };

    return success(converted);
  } catch (err) {
    logger.error('PUT /api/v1/affiliate/products/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update affiliate product', 500);
  }
}
