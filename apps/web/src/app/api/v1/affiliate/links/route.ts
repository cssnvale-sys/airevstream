import { authenticate, success, error, paginated, parseQuery, validationError, notFound, forbidden } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const CreateLinkSchema = z.object({
  productId: z.string().uuid(),
  shortUrl: z.string().url().max(500).optional().nullable(),
}).strict();

/**
 * GET /api/v1/affiliate/links
 * List affiliate products that have shortened links.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip } = parseQuery(req);

    // Scope by tenant via channelPools chain + require shortUrl set
    const where: Record<string, unknown> = { shortUrl: { not: null } };
    if (ctx.tenantId) {
      where.channelPools = {
        some: {
          channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
        },
      };
    }

    const [items, total] = await Promise.all([
      ctx.db.affiliateProduct.findMany({
        where,
        select: {
          id: true,
          name: true,
          url: true,
          shortUrl: true,
          category: true,
          totalClicks: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      ctx.db.affiliateProduct.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/affiliate/links error:', err);
    return error('INTERNAL_ERROR', 'Failed to list affiliate links', 500);
  }
}

/**
 * POST /api/v1/affiliate/links
 * Create or update a shortened link for an affiliate product.
 * Body: { productId, shortUrl? }
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`affiliate/links:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = CreateLinkSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { productId, shortUrl } = parsed.data;

    const product = await ctx.db.affiliateProduct.findUnique({ where: { id: productId } });
    if (!product) {
      return notFound('Affiliate product not found');
    }

    // Verify tenant ownership via channelPools chain
    if (ctx.tenantId) {
      const tenantPool = await ctx.db.channelAffiliatePool.findFirst({
        where: {
          affiliateProductId: productId,
          channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
        },
        select: { channelId: true },
      });
      if (!tenantPool) return notFound('Affiliate product not found');
    }

    // Generate a short URL if not provided
    const generatedShortUrl = shortUrl ?? `https://link.airevstream.local/${randomBytes(4).toString('hex')}`;

    const updated = await ctx.db.affiliateProduct.update({
      where: { id: productId },
      data: { shortUrl: generatedShortUrl },
      select: {
        id: true,
        name: true,
        url: true,
        shortUrl: true,
      },
    });

    return success(updated);
  } catch (err) {
    console.error('POST /api/v1/affiliate/links error:', err);
    return error('INTERNAL_ERROR', 'Failed to create affiliate link', 500);
  }
}
