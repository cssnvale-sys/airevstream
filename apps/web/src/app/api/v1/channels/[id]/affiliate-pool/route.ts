import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/channels/[id]/affiliate-pool
 * List affiliate products in a channel's pool
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findUnique({ where: { id } });
    if (!channel) return notFound('Channel not found');

    const pool = await ctx.db.channelAffiliatePool.findMany({
      where: { channelId: id },
      include: {
        affiliateProduct: true,
      },
      orderBy: { performanceScore: 'desc' },
    });

    // Convert Prisma Decimal fields to numbers for JSON serialization
    const data = pool.map((entry) => ({
      ...entry.affiliateProduct,
      commissionRate: entry.affiliateProduct.commissionRate != null ? Number(entry.affiliateProduct.commissionRate) : null,
      totalRevenue: Number(entry.affiliateProduct.totalRevenue),
      isAutoSuggested: entry.isAutoSuggested,
      performanceScore: Number(entry.performanceScore),
      lastUsedAt: entry.lastUsedAt,
    }));

    return success(data);
  } catch (err) {
    console.error('GET affiliate-pool failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list affiliate pool', 500);
  }
}

/**
 * POST /api/v1/channels/[id]/affiliate-pool
 * Add an affiliate product to a channel's pool
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findUnique({ where: { id } });
    if (!channel) return notFound('Channel not found');

    const body = await req.json();
    const { affiliateProductId } = body;

    if (!affiliateProductId) {
      return validationError('affiliateProductId is required');
    }

    // Verify product exists
    const product = await ctx.db.affiliateProduct.findUnique({
      where: { id: affiliateProductId },
    });
    if (!product) return notFound('Affiliate product not found');

    // Check if already in pool
    const existing = await ctx.db.channelAffiliatePool.findUnique({
      where: {
        channelId_affiliateProductId: { channelId: id, affiliateProductId },
      },
    });
    if (existing) {
      return error('CONFLICT', 'Product is already in this channel pool', 409);
    }

    const entry = await ctx.db.channelAffiliatePool.create({
      data: {
        channelId: id,
        affiliateProductId,
      },
      include: {
        affiliateProduct: true,
      },
    });

    return success({
      ...entry.affiliateProduct,
      commissionRate: entry.affiliateProduct.commissionRate != null ? Number(entry.affiliateProduct.commissionRate) : null,
      totalRevenue: Number(entry.affiliateProduct.totalRevenue),
      isAutoSuggested: entry.isAutoSuggested,
      performanceScore: Number(entry.performanceScore),
      lastUsedAt: entry.lastUsedAt,
    });
  } catch (err) {
    console.error('POST affiliate-pool failed:', err);
    return error('INTERNAL_ERROR', 'Failed to add product to affiliate pool', 500);
  }
}
