import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  authenticateAny,
  success,
  error,
  validationError,
  formatZodErrors,
  isUUID,
} from '@/lib/api-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/affiliate/clicks/[id]/convert
 *
 * Records a conversion against a previously tracked click. The redirect
 * endpoint (GET /api/v1/affiliate/redirect/[shortCode]) only knows the user
 * clicked — revenue and conversion status arrive later via postback from the
 * affiliate network (Amazon Associates Reports, Impact postbacks, ShareASale
 * pixels, etc.). This endpoint closes that loop so the revenue dashboard
 * reports real numbers instead of permanently zero.
 *
 * Accepts Bearer JWT (manual entry from admin UI) or X-API-Key (network
 * postback). The click is tenant-scoped through the channel→socialAccount→
 * emailAccount chain, so cross-tenant conversions are blocked.
 *
 * Body:
 *   - revenue: number (required, positive decimal, ≤ 999,999.99)
 *   - currency: string (optional, informational — stored in nothing today
 *     because the click row doesn't carry currency; kept in the request for
 *     future use and to reject obviously wrong postbacks)
 *   - orderId: string (optional, informational for deduplication)
 */
const ConvertSchema = z.object({
  revenue: z.number().positive().max(999_999.99),
  currency: z.string().length(3).optional().nullable(),
  orderId: z.string().max(200).optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticateAny(req, 'write');
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return error('VALIDATION_ERROR', 'Invalid click id', 400);

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = ConvertSchema.safeParse(body);
    if (!parsed.success) return validationError(formatZodErrors(parsed.error.errors));
    const { revenue } = parsed.data;

    // Load the click and verify tenant ownership through the channel chain.
    // Clicks without a channelId are direct/unattributed — we reject those
    // for conversion tracking since we can't prove tenant ownership.
    const click = await ctx.db.affiliateClick.findUnique({
      where: { id },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            socialAccount: { select: { emailAccount: { select: { tenantId: true } } } },
          },
        },
      },
    });

    if (!click) return error('NOT_FOUND', 'Click not found', 404);
    const clickTenantId = click.channel?.socialAccount?.emailAccount?.tenantId;
    if (!clickTenantId || clickTenantId !== ctx.tenantId) {
      return error('NOT_FOUND', 'Click not found', 404);
    }

    if (click.converted) {
      return error('CONFLICT', 'Click has already been converted', 409);
    }

    const updated = await ctx.db.$transaction(async (tx) => {
      const c = await tx.affiliateClick.update({
        where: { id },
        data: { converted: true, revenue },
      });
      // Bump the product's revenue counters so AffiliateProduct summaries
      // stay in sync with the aggregate across clicks.
      await tx.affiliateProduct.update({
        where: { id: click.productId },
        data: { totalRevenue: { increment: revenue }, totalConversions: { increment: 1 } },
      }).catch((err) => {
        // Some older deployments don't have totalRevenue/totalConversions —
        // log and swallow so the conversion is still recorded.
        logger.warn('[affiliate/convert] product counter update skipped', {
          err: err instanceof Error ? err.message : String(err),
          productId: click.productId,
        });
      });
      return c;
    });

    return success({
      id: updated.id,
      productId: updated.productId,
      converted: updated.converted,
      revenue: updated.revenue != null ? Number(updated.revenue) : null,
    });
  } catch (err) {
    logger.error('POST /api/v1/affiliate/clicks/[id]/convert error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to record conversion', 500);
  }
}
