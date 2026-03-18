import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scopes: z.array(z.string()).optional(),
  status: z.enum(['active', 'revoked']).optional(),
});

/**
 * GET /api/v1/api-keys/[id]
 * Get API key metadata (not the key itself)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
    if (!user || !user.tenantId) {
      return error('BAD_REQUEST', 'User is not assigned to a tenant', 400);
    }

    const apiKey = await ctx.db.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitRpm: true,
        lastUsedAt: true,
        expiresAt: true,
        status: true,
        createdAt: true,
      },
    });

    if (!apiKey) return notFound('API key not found');

    // Ensure the key belongs to the user's tenant
    if (apiKey.tenantId !== user.tenantId) {
      return notFound('API key not found');
    }

    return success(apiKey);
  } catch (err) {
    console.error('GET /api/v1/api-keys/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch API key', 500);
  }
}

/**
 * PATCH /api/v1/api-keys/[id]
 * Update API key metadata (name, scopes, status)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
    if (!user || !user.tenantId) {
      return error('BAD_REQUEST', 'User is not assigned to a tenant', 400);
    }

    const existing = await ctx.db.apiKey.findUnique({ where: { id } });
    if (!existing) return notFound('API key not found');

    // Ensure the key belongs to the user's tenant
    if (existing.tenantId !== user.tenantId) {
      return notFound('API key not found');
    }

    const body = await req.json();
    const parsed = updateApiKeySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { name, scopes, status } = parsed.data;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (scopes !== undefined) data.scopes = scopes;
    if (status !== undefined) data.status = status;

    const updated = await ctx.db.apiKey.update({
      where: { id },
      data,
      select: {
        id: true,
        tenantId: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitRpm: true,
        lastUsedAt: true,
        expiresAt: true,
        status: true,
        createdAt: true,
      },
    });

    return success(updated);
  } catch (err) {
    console.error('PATCH /api/v1/api-keys/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update API key', 500);
  }
}

/**
 * DELETE /api/v1/api-keys/[id]
 * Revoke an API key (set status to 'revoked')
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
    if (!user || !user.tenantId) {
      return error('BAD_REQUEST', 'User is not assigned to a tenant', 400);
    }

    const existing = await ctx.db.apiKey.findUnique({ where: { id } });
    if (!existing) return notFound('API key not found');

    // Ensure the key belongs to the user's tenant
    if (existing.tenantId !== user.tenantId) {
      return notFound('API key not found');
    }

    if (existing.status === 'revoked') {
      return error('BAD_REQUEST', 'API key is already revoked', 400);
    }

    const updated = await ctx.db.apiKey.update({
      where: { id },
      data: { status: 'revoked' },
      select: {
        id: true,
        tenantId: true,
        name: true,
        keyPrefix: true,
        status: true,
        createdAt: true,
      },
    });

    return success(updated);
  } catch (err) {
    console.error('DELETE /api/v1/api-keys/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to revoke API key', 500);
  }
}
