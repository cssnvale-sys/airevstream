import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  tenantId: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/v1/users/[id]
 * Get user profile.
 * Admins may view any user; non-admins may only view their own profile.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`users:GET:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  // Non-admins can only view their own profile
  if (ctx.role !== 'admin' && ctx.userId !== id) {
    return error('FORBIDDEN', 'You can only view your own profile', 403);
  }

  try {
    const user = await ctx.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
          },
        },
      },
    });

    if (!user) return notFound('User not found');

    return success(user);
  } catch (err) {
    console.error('GET /api/v1/users/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch user', 500);
  }
}

/**
 * PATCH /api/v1/users/[id]
 * Update user profile
 * - Regular users can update their own name, avatarUrl
 * - Admins can also update role, tenantId
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`users:PATCH:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const targetUser = await ctx.db.user.findUnique({ where: { id } });
    if (!targetUser) return notFound('User not found');

    const isAdmin = ctx.role === 'admin';
    const isSelf = ctx.userId === id;

    // Non-admins can only update themselves
    if (!isAdmin && !isSelf) {
      return forbidden('You can only update your own profile');
    }

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { name, avatarUrl, role, tenantId } = parsed.data;

    // Non-admins cannot change role or tenantId
    if (!isAdmin && (role !== undefined || tenantId !== undefined)) {
      return forbidden('Only admins can change role or tenant assignment');
    }

    // Validate tenant exists if tenantId is being set
    if (tenantId !== undefined && tenantId !== null) {
      const tenant = await ctx.db.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        return validationError('Tenant not found');
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (isAdmin && role !== undefined) data.role = role;
    if (isAdmin && tenantId !== undefined) data.tenantId = tenantId;

    const updated = await ctx.db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return success(updated);
  } catch (err) {
    console.error('PATCH /api/v1/users/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update user', 500);
  }
}
