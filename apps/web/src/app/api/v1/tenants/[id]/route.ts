import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, requireAdmin, formatZodErrors } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
  settings: z.record(z.unknown()).optional(),
  limits: z.object({
    maxAccounts: z.number().int().optional(),
    maxChannels: z.number().int().optional(),
    maxContentPerMonth: z.number().int().optional(),
    storageGb: z.number().optional(),
  }).optional(),
});

/**
 * GET /api/v1/tenants/[id]
 * Get tenant with user count and subscription info.
 * Admins may view any tenant; non-admins may only view their own tenant.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`tenants:GET:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  // Non-admins can only view their own tenant
  if (ctx.role !== 'admin' && ctx.tenantId !== id) {
    return error('FORBIDDEN', 'You do not have access to this tenant', 403);
  }

  try {
    const tenant = await ctx.db.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            apiKeys: true,
          },
        },
        subscriptions: {
          where: { status: { in: ['active', 'trialing', 'past_due'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
          take: 50,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) return notFound('Tenant not found');

    const { _count, subscriptions, ...rest } = tenant;
    const data = {
      ...rest,
      userCount: _count.users,
      apiKeyCount: _count.apiKeys,
      activeSubscription: subscriptions[0] ?? null,
    };

    return success(data);
  } catch (err) {
    logger.error('GET /api/v1/tenants/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch tenant', 500);
  }
}

/**
 * PATCH /api/v1/tenants/[id]
 * Update tenant (admin only)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const adminCheck = requireAdmin(ctx);
  if (adminCheck) return adminCheck;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`tenants:PATCH:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.tenant.findUnique({ where: { id } });
    if (!existing) return notFound('Tenant not found');

    const body = await req.json();
    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { name, plan, status, settings, limits } = parsed.data;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (plan !== undefined) data.plan = plan;
    if (status !== undefined) data.status = status;
    if (settings !== undefined) data.settings = settings;
    if (limits !== undefined) {
      // Merge with existing limits
      const existingLimits = (existing.limits as Record<string, unknown>) ?? {};
      data.limits = { ...existingLimits, ...limits };
    }

    const updated = await ctx.db.tenant.update({
      where: { id },
      data,
    });

    return success(updated);
  } catch (err) {
    logger.error('PATCH /api/v1/tenants/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update tenant', 500);
  }
}
