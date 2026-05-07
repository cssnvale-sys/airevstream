import { error } from '@/lib/api-server';
import { getDb } from '@airevstream/db';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/** Rate limit for public redirect: 60 clicks per minute per IP */
const REDIRECT_RATE_LIMIT = { maxAttempts: 60, windowMs: 60 * 1000 };

type RouteParams = { params: Promise<{ shortCode: string  }> };

/**
 * GET /api/v1/affiliate/redirect/[shortCode]
 * Public redirect endpoint — no auth required.
 *
 * Looks up an AffiliateProduct by shortUrl matching the shortCode,
 * records an AffiliateClick with analytics data, increments totalClicks,
 * and redirects (302) to the product's full URL.
 *
 * Optional query params for attribution:
 *   - platform: originating platform (youtube, tiktok, etc.)
 *   - contentId: content item that contained the link
 *   - channelId: channel that published the link
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { shortCode } = await params;

  // IP-based rate limiting to prevent click fraud
  const ip = getClientIp(req);
  const rl = checkRateLimit(`affiliate/redirect:${ip}`, REDIRECT_RATE_LIMIT);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const db = getDb();
    const url = new URL(req.url);

    // Extract attribution query params
    const platform = url.searchParams.get('platform') ?? null;
    const contentId = url.searchParams.get('contentId') ?? null;
    const channelId = url.searchParams.get('channelId') ?? null;

    // Look up the affiliate product by matching shortUrl.
    // The shortUrl stored in the DB may be a full URL like
    // "https://link.airevstream.local/<shortCode>" or just the code.
    // We use `endsWith` to match the code suffix precisely (avoids false
    // positives from `contains` on partial matches).
    const product = await db.affiliateProduct.findFirst({
      where: {
        shortUrl: { endsWith: `/${shortCode}` },
        status: 'active',
      },
      select: {
        id: true,
        url: true,
        shortUrl: true,
      },
    });

    if (!product) {
      return error('NOT_FOUND', 'Link not found', 404);
    }

    // Hash the client IP for privacy-safe analytics
    const forwarded = req.headers.get('x-forwarded-for');
    const clientIp = forwarded?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown';
    const ipHash = createHash('sha256').update(clientIp).digest('hex');

    const userAgent = req.headers.get('user-agent') ?? null;

    // Record the click and increment counter atomically
    await db.$transaction([
      db.affiliateClick.create({
        data: {
          productId: product.id,
          contentId,
          channelId,
          platform,
          ipHash,
          userAgent,
        },
      }),
      db.affiliateProduct.update({
        where: { id: product.id },
        data: { totalClicks: { increment: 1 } },
      }),
    ]);

    // Validate redirect URL protocol to prevent open redirect / XSS
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(product.url);
    } catch (urlErr) {
      console.error('Invalid product URL for redirect:', product.id, urlErr);
      return error('INVALID_URL', 'Product has an invalid URL', 500);
    }
    if (redirectUrl.protocol !== 'https:' && redirectUrl.protocol !== 'http:') {
      return error('INVALID_URL', 'Product URL uses an unsupported protocol', 400);
    }

    // 302 redirect to the actual affiliate URL
    return NextResponse.redirect(redirectUrl.toString(), 302);
  } catch (err) {
    logger.error('GET /api/v1/affiliate/redirect/[shortCode] error', err as Error);
    return error('INTERNAL_ERROR', 'Redirect failed', 500);
  }
}
