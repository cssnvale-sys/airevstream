import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@airevstream/db';
import { success, error } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Public: 120 req/min per IP. Above that, return 429.
const PUBLIC_STOREFRONT_RATE_LIMIT = { maxAttempts: 120, windowMs: 60 * 1000 };

/**
 * GET /api/v1/public/storefronts/[slug]
 *
 * Public, unauthenticated read of a published storefront by slug. Used by the
 * `/p/[slug]` public page. Only `status='published'` storefronts are returned;
 * drafts and archived storefronts return 404 so draft URLs cannot be scraped.
 *
 * Returns the bare minimum the public page needs to render — channel branding
 * and a list of featured/active products with their resolved public link URL.
 */
export async function GET(req: NextRequest, context: { params: Promise<{  slug: string  }> }) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`public/storefronts:${ip}`, PUBLIC_STOREFRONT_RATE_LIMIT);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  const params = await context.params;
  const { slug } = await params;
  if (!slug || slug.length > 100) return error('NOT_FOUND', 'Storefront not found', 404);
  try {
    const db = getDb();
    const storefront = await db.storefront.findFirst({
      where: { slug, status: 'published' },
      include: {
        channel: { select: { id: true, name: true, primaryLanguage: true } },
        products: {
          where: { status: 'active' },
          orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }],
          include: {
            affiliateProduct: {
              select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
                shortUrl: true,
                category: true,
                brand: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!storefront) return error('NOT_FOUND', 'Storefront not found', 404);

    // Hide products whose AffiliateProduct is no longer active even if the
    // StorefrontProduct row is still marked active.
    const visibleProducts = storefront.products
      .filter((sp) => sp.affiliateProduct && sp.affiliateProduct.status === 'active')
      .map((sp) => ({
        id: sp.id,
        displayOrder: sp.displayOrder,
        featured: sp.featured,
        title: sp.customTitle ?? sp.affiliateProduct.name,
        description: sp.customDescription ?? sp.affiliateProduct.description,
        imageUrl: sp.affiliateProduct.imageUrl,
        category: sp.affiliateProduct.category,
        brand: sp.affiliateProduct.brand,
        // shortUrl is the /api/v1/affiliate/redirect/<code> target — consumers
        // hit that URL so the click is recorded before the final redirect.
        url: sp.affiliateProduct.shortUrl,
      }));

    return success({
      name: storefront.name,
      slug: storefront.slug,
      description: storefront.description,
      logoUrl: storefront.logoUrl,
      bannerUrl: storefront.bannerUrl,
      theme: storefront.theme,
      channel: { name: storefront.channel.name },
      products: visibleProducts,
      productCount: visibleProducts.length,
    });
  } catch (err) {
    logger.error('GET /api/v1/public/storefronts/[slug] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to load storefront', 500);
  }
}
