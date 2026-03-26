import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

const updateStorefrontSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'slug must be lowercase alphanumeric with hyphens only'
  ).optional(),
  description: z.string().nullish(),
  logoUrl: z.string().url().nullish(),
  bannerUrl: z.string().url().nullish(),
  theme: z.record(z.unknown()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  customDomain: z.string().max(255).nullish(),
});

/**
 * GET /api/v1/affiliate/storefronts/[id]
 * Get a single storefront with its products.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const storefront = await ctx.db.storefront.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      include: {
        products: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!storefront) return notFound('Storefront not found');

    return success(storefront);
  } catch (err) {
    console.error('GET /api/v1/affiliate/storefronts/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch storefront', 500);
  }
}

/**
 * PATCH /api/v1/affiliate/storefronts/[id]
 * Update a storefront.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`affiliate/storefronts/[id]:patch:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.storefront.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true },
    });
    if (!existing) return notFound('Storefront not found');

    const body = await req.json();
    const parsed = updateStorefrontSchema.safeParse(body);

    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => e.message).join(', ');
      return validationError(messages);
    }

    const data = parsed.data;

    const updated = await ctx.db.storefront.update({
      where: { id },
      data: data as any,
      include: {
        products: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      console.error('PATCH /api/v1/affiliate/storefronts/[id] slug conflict:', err.meta);
      return error('CONFLICT', 'A storefront with this slug already exists', 409);
    }
    console.error('PATCH /api/v1/affiliate/storefronts/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to update storefront', 500);
  }
}

/**
 * DELETE /api/v1/affiliate/storefronts/[id]
 * Delete a storefront and all its products (cascade).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`affiliate/storefronts/[id]:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.storefront.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true },
    });
    if (!existing) return notFound('Storefront not found');

    await ctx.db.storefront.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/affiliate/storefronts/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to delete storefront', 500);
  }
}
