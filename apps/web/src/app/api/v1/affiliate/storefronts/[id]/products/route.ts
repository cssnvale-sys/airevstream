import { authenticate, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

const addProductSchema = z.object({
  affiliateProductId: z.string().uuid('affiliateProductId must be a valid UUID'),
  displayOrder: z.number().int().min(0).optional().default(0),
  featured: z.boolean().optional().default(false),
  customTitle: z.string().max(255).nullish(),
  customDescription: z.string().nullish(),
});

/**
 * GET /api/v1/affiliate/storefronts/[id]/products
 * List products in a storefront, ordered by displayOrder.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify storefront exists and belongs to this tenant
    const storefront = await ctx.db.storefront.findUnique({ where: { id } });
    if (!storefront) return notFound('Storefront not found');

    const ownsChannel = await ctx.db.channel.findFirst({
      where: {
        id: storefront.channelId,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
      select: { id: true },
    });
    if (!ownsChannel) return notFound('Storefront not found');

    const products = await ctx.db.storefrontProduct.findMany({
      where: { storefrontId: id },
      orderBy: { displayOrder: 'asc' },
    });

    return success(products);
  } catch (err) {
    logger.error('GET /api/v1/affiliate/storefronts/[id]/products error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to list storefront products', 500);
  }
}

/**
 * POST /api/v1/affiliate/storefronts/[id]/products
 * Add a product to a storefront.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`affiliate-storefront-products:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify storefront exists and belongs to this tenant
    const storefront = await ctx.db.storefront.findUnique({ where: { id } });
    if (!storefront) return notFound('Storefront not found');

    const ownsChannel = await ctx.db.channel.findFirst({
      where: {
        id: storefront.channelId,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
      select: { id: true },
    });
    if (!ownsChannel) return notFound('Storefront not found');

    const body = await req.json();
    const parsed = addProductSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { affiliateProductId, displayOrder, featured, customTitle, customDescription } = parsed.data;

    // Verify affiliate product exists
    const affiliateProduct = await ctx.db.affiliateProduct.findUnique({
      where: { id: affiliateProductId },
    });
    if (!affiliateProduct) {
      return notFound('Affiliate product not found');
    }

    // Check if already added to this storefront
    const existingEntry = await ctx.db.storefrontProduct.findFirst({
      where: { storefrontId: id, affiliateProductId },
    });
    if (existingEntry) {
      return error('CONFLICT', 'This product is already in the storefront', 409);
    }

    const storefrontProduct = await ctx.db.storefrontProduct.create({
      data: {
        storefrontId: id,
        affiliateProductId,
        displayOrder,
        featured,
        customTitle: customTitle ?? null,
        customDescription: customDescription ?? null,
      },
    });

    return success(storefrontProduct);
  } catch (err) {
    logger.error('POST /api/v1/affiliate/storefronts/[id]/products error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to add product to storefront', 500);
  }
}
