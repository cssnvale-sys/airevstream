import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/accounts/[id]
 * Get email account detail with full nested relations
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

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

    const { passwordEnc, ...safe } = account;
    // Strip encrypted credentials from social accounts
    const data = {
      ...safe,
      socialAccounts: safe.socialAccounts.map(({ credentialsEnc, ...sa }) => sa),
    };

    return success(data);
  } catch (err) {
    console.error('GET /api/v1/accounts/[id] failed:', err);
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

  const { id } = await params;

  try {
    const existing = await ctx.db.emailAccount.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return notFound('Email account not found');

    const body = await req.json();
    const { status, tier, notes } = body;

    const validStatuses = ['active', 'disabled', 'flagged', 'pending'];
    if (status && !validStatuses.includes(status)) {
      return validationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const validTiers = ['tier1', 'tier2', 'tier3'];
    if (tier && !validTiers.includes(tier)) {
      return validationError(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
    }

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
    console.error('PUT /api/v1/accounts/[id] failed:', err);
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

  const { id } = await params;

  try {
    const existing = await ctx.db.emailAccount.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return notFound('Email account not found');

    await ctx.db.emailAccount.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/accounts/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to delete account', 500);
  }
}
