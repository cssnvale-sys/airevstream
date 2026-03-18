import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, paginated, parseQuery, validationError } from '@/lib/api-server';

const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'),
  limits: z.object({
    maxAccounts: z.number().int().min(0).optional(),
    maxChannels: z.number().int().min(0).optional(),
    maxContentPerMonth: z.number().int().min(0).optional(),
    storageGb: z.number().min(0).optional(),
  }).optional(),
});

/**
 * GET /api/v1/tenants
 * List tenants (admin only)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  // Use role from JWT/context rather than an extra DB round-trip
  if (ctx.role !== 'admin') {
    return error('FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const { page, limit, skip, sort, order, search } = parseQuery(req);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');
    const planFilter = url.searchParams.get('plan');

    const validStatuses = ['active', 'suspended', 'trial'];
    const validPlans = ['free', 'starter', 'pro', 'enterprise'];

    if (statusFilter && validStatuses.includes(statusFilter)) where.status = statusFilter;
    if (planFilter && validPlans.includes(planFilter)) where.plan = planFilter;

    const allowedSorts = ['name', 'slug', 'createdAt', 'plan', 'status'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const [tenants, total] = await Promise.all([
      ctx.db.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: order },
        include: {
          _count: {
            select: {
              users: true,
              subscriptions: true,
              apiKeys: true,
            },
          },
        },
      }),
      ctx.db.tenant.count({ where }),
    ]);

    const data = tenants.map(({ _count, ...tenant }) => ({
      ...tenant,
      userCount: _count.users,
      subscriptionCount: _count.subscriptions,
      apiKeyCount: _count.apiKeys,
    }));

    return paginated(data, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/tenants failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list tenants', 500);
  }
}

/**
 * POST /api/v1/tenants
 * Create a new tenant (admin only)
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return error('FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const body = await req.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { name, slug, plan, limits } = parsed.data;

    // Check for duplicate slug
    const existing = await ctx.db.tenant.findUnique({ where: { slug } });
    if (existing) {
      return error('CONFLICT', 'A tenant with this slug already exists', 409);
    }

    const defaultLimits = {
      maxAccounts: 5,
      maxChannels: 3,
      maxContentPerMonth: 100,
      storageGb: 1,
      ...(plan === 'starter' ? { maxAccounts: 20, maxChannels: 10, maxContentPerMonth: 500, storageGb: 10 } : {}),
      ...(plan === 'pro' ? { maxAccounts: 100, maxChannels: 50, maxContentPerMonth: 5000, storageGb: 100 } : {}),
      ...(plan === 'enterprise' ? { maxAccounts: -1, maxChannels: -1, maxContentPerMonth: -1, storageGb: -1 } : {}),
      ...limits,
    };

    const tenant = await ctx.db.tenant.create({
      data: {
        name,
        slug,
        plan,
        limits: defaultLimits,
        settings: {},
      },
    });

    return success(tenant);
  } catch (err) {
    console.error('POST /api/v1/tenants failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create tenant', 500);
  }
}
