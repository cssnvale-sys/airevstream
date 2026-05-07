import { authenticate, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const AddToPoolSchema = z.object({
  affiliateProductId: z.string().uuid('affiliateProductId must be a valid UUID'),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/v1/channels/[id]/affiliate-pool?affiliateProductId=xxx
 * Remove an affiliate product from a channel's pool
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`affiliate-pool:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id: channelId } = await params;
  if (!isUUID(channelId)) return validationError('Invalid ID format');

  try {
    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id: channelId,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
      select: { id: true },
    });
    if (!channel) return notFound('Channel not found');

    const affiliateProductId = req.nextUrl.searchParams.get('affiliateProductId');

    if (!affiliateProductId || !isUUID(affiliateProductId)) {
      return validationError('Valid affiliateProductId is required');
    }

    await ctx.db.channelAffiliatePool.deleteMany({
      where: { channelId, affiliateProductId },
    });

    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/channels/[id]/affiliate-pool failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to remove from pool', 500);
  }
}

/**
 * GET /api/v1/channels/[id]/affiliate-pool
 * List affiliate products in a channel's pool
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
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
    logger.error('GET affiliate-pool failed', err as Error);
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
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`affiliate-pool:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    const body = await req.json();
    const parsed = AddToPoolSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }
    const { affiliateProductId } = parsed.data;

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
    logger.error('POST affiliate-pool failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to add product to affiliate pool', 500);
  }
}
