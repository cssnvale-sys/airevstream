import { authenticate, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

const UpdateAccountSchema = z.object({
  status: z.enum(['active', 'disabled', 'flagged', 'pending']).optional(),
  tier: z.enum(['tier1', 'tier2', 'tier3']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * GET /api/v1/accounts/[id]
 * Get email account detail with full nested relations
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const account = await ctx.db.emailAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        socialAccounts: {
          include: {
            channels: {
              include: {
                channelAvatars: {
                  include: {
                    avatar: true,
                  },
                },
                brandingPackages: true,
                affiliatePool: {
                  include: {
                    affiliateProduct: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!account) return notFound('Email account not found');

    // Also fetch lifecycle status
    const lifecycle = await ctx.db.accountLifecycle.findUnique({
      where: { emailAccountId: id },
    });

    const { passwordEnc, ...safe } = account;
    // Strip encrypted credentials from social accounts
    const data = {
      ...safe,
      socialAccounts: safe.socialAccounts.map(({ credentialsEnc: _credentialsEnc, ...sa }: { credentialsEnc: unknown; [key: string]: unknown }) => sa),
      lifecycle: lifecycle ? {
        id: lifecycle.id,
        status: lifecycle.status,
        targetPlatforms: lifecycle.targetPlatforms,
        discoveryResults: lifecycle.discoveryResults,
        currentStep: lifecycle.currentStep,
        cohortId: lifecycle.cohortId,
        error: lifecycle.error,
        startedAt: lifecycle.startedAt?.toISOString() ?? null,
        completedAt: lifecycle.completedAt?.toISOString() ?? null,
      } : null,
    };

    return success(data);
  } catch (err) {
    logger.error('GET /api/v1/accounts/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch account', 500);
  }
}

/**
 * PUT /api/v1/accounts/[id]
 * Update email account (status, tier, notes)
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`accounts/[id]:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.emailAccount.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return notFound('Email account not found');

    const body = await req.json();
    const parsed = UpdateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }
    const { status, tier, notes } = parsed.data;

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (tier !== undefined) data.tier = tier;
    if (notes !== undefined) data.notes = notes;

    const updated = await ctx.db.emailAccount.update({
      where: { id },
      data,
    });

    const { passwordEnc, ...safe } = updated;
    return success(safe);
  } catch (err) {
    logger.error('PUT /api/v1/accounts/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update account', 500);
  }
}

/**
 * DELETE /api/v1/accounts/[id]
 * Delete email account (cascades to social accounts and channels)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`accounts/[id]:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.emailAccount.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return notFound('Email account not found');

    await ctx.db.emailAccount.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/accounts/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete account', 500);
  }
}
