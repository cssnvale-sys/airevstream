import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

const updateSubscriptionSchema = z.object({
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  cancel: z.boolean().optional(),
  status: z.enum(['active', 'cancelled', 'past_due', 'trialing']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/subscriptions/[id]
 * Get subscription details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const subscription = await ctx.db.subscription.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            limits: true,
            status: true,
          },
        },
      },
    });

    if (!subscription) return notFound('Subscription not found');

    // Verify the requesting user has access to this subscription's tenant
    const isAdmin = ctx.role === 'admin';
    const isTenantMember = ctx.tenantId === subscription.tenantId;

    if (!isAdmin && !isTenantMember) {
      return notFound('Subscription not found');
    }

    return success(subscription);
  } catch (err) {
    console.error('GET /api/v1/subscriptions/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch subscription', 500);
  }
}

/**
 * PATCH /api/v1/subscriptions/[id]
 * Update subscription (cancel, change plan)
 * - If cancel: true, set cancelAtPeriodEnd=true
 * - If plan changed, update plan and tenant plan
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`subscriptions/[id]:patch:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.subscription.findUnique({ where: { id } });
    if (!existing) return notFound('Subscription not found');

    // Verify access — ctx already has role and tenantId from authenticate()
    const isAdmin = ctx.role === 'admin';
    const isTenantMember = ctx.tenantId === existing.tenantId;

    if (!isAdmin && !isTenantMember) {
      return notFound('Subscription not found');
    }

    const body = await req.json();
    const parsed = updateSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { plan, cancel, status, metadata } = parsed.data;

    const data: Record<string, unknown> = {};

    // Handle cancellation
    if (cancel === true) {
      data.cancelAtPeriodEnd = true;
      // If they want immediate cancellation, also update status
    }

    if (cancel === false) {
      // Reactivate - remove pending cancellation
      data.cancelAtPeriodEnd = false;
    }

    // Handle plan change
    if (plan !== undefined && plan !== existing.plan) {
      data.plan = plan;
    }

    if (status !== undefined) {
      data.status = status;

      // If cancelling, also update tenant status
      if (status === 'cancelled') {
        data.cancelAtPeriodEnd = true;
      }
    }

    if (metadata !== undefined) {
      // Merge with existing metadata
      const existingMeta = (existing.metadata as Record<string, unknown>) ?? {};
      data.metadata = { ...existingMeta, ...metadata };
    }

    // Use transaction when plan change requires updating both subscription and tenant
    const needsTenantUpdate = plan !== undefined && plan !== existing.plan;

    let updated;
    if (needsTenantUpdate) {
      const [subscriptionResult] = await ctx.db.$transaction([
        ctx.db.subscription.update({
          where: { id },
          data,
          include: {
            tenant: {
              select: { id: true, name: true, slug: true, plan: true, limits: true },
            },
          },
        }),
        ctx.db.tenant.update({
          where: { id: existing.tenantId },
          data: {
            plan: plan!,
            limits: getPlanLimits(plan!),
          },
        }),
      ]);
      updated = subscriptionResult;
    } else {
      updated = await ctx.db.subscription.update({
        where: { id },
        data,
        include: {
          tenant: {
            select: { id: true, name: true, slug: true, plan: true, limits: true },
          },
        },
      });
    }

    return success(updated);
  } catch (err) {
    console.error('PATCH /api/v1/subscriptions/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update subscription', 500);
  }
}

function getPlanLimits(plan: string): Record<string, number> {
  switch (plan) {
    case 'free':
      return { maxAccounts: 5, maxChannels: 3, maxContentPerMonth: 100, storageGb: 1 };
    case 'starter':
      return { maxAccounts: 20, maxChannels: 10, maxContentPerMonth: 500, storageGb: 10 };
    case 'pro':
      return { maxAccounts: 100, maxChannels: 50, maxContentPerMonth: 5000, storageGb: 100 };
    case 'enterprise':
      return { maxAccounts: -1, maxChannels: -1, maxContentPerMonth: -1, storageGb: -1 };
    default:
      return { maxAccounts: 5, maxChannels: 3, maxContentPerMonth: 100, storageGb: 1 };
  }
}
