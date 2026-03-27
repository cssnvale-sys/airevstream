import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, paginated, parseQuery, validationError, forbidden, formatZodErrors } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const createSubscriptionSchema = z.object({
  tenantId: z.string().uuid(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
});

/**
 * GET /api/v1/subscriptions
 * List subscriptions for the current user's tenant
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.tenantId) {
    return error('BAD_REQUEST', 'User is not assigned to a tenant', 400);
  }

  try {
    const { page, limit, skip } = parseQuery(req);

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status') ?? undefined;

    const validStatuses = ['active', 'trialing', 'past_due', 'cancelled', 'expired'];

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
    };
    if (statusFilter && validStatuses.includes(statusFilter)) where.status = statusFilter;

    const [subscriptions, total] = await Promise.all([
      ctx.db.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
            },
          },
        },
      }),
      ctx.db.subscription.count({ where }),
    ]);

    return paginated(subscriptions, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/subscriptions failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list subscriptions', 500);
  }
}

/**
 * POST /api/v1/subscriptions
 * Create a subscription (placeholder - would integrate with Stripe)
 * Sets period to current month
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`subscriptions:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = createSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { tenantId, plan } = parsed.data;

    // Authorization: only allow creating subscriptions for own tenant (or admin for any)
    if (ctx.tenantId !== tenantId && ctx.role !== 'admin') {
      return error('FORBIDDEN', 'Cannot create subscription for another tenant', 403);
    }

    // Verify tenant exists
    const tenant = await ctx.db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return validationError('Tenant not found');
    }

    // Check for existing active subscription
    const existingActive = await ctx.db.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (existingActive) {
      return error('CONFLICT', 'Tenant already has an active subscription. Use PATCH to modify it.', 409);
    }

    // Set period to current month
    const now = new Date();
    const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Create subscription and update tenant plan atomically
    const [subscription] = await ctx.db.$transaction([
      ctx.db.subscription.create({
        data: {
          tenantId,
          plan,
          status: 'active',
          currentPeriodStart,
          currentPeriodEnd,
          metadata: {
            createdBy: ctx.userId,
            note: 'Placeholder subscription - Stripe integration pending',
          },
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      ctx.db.tenant.update({
        where: { id: tenantId },
        data: { plan },
      }),
    ]);

    return success(subscription);
  } catch (err) {
    console.error('POST /api/v1/subscriptions failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create subscription', 500);
  }
}
