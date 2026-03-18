import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError } from '@/lib/api-server';

/**
 * POST /api/v1/accounts/bulk-delete
 * Delete multiple email accounts by ID.
 * Body: { ids: string[] }
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const { ids } = body as { ids?: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return validationError('ids must be a non-empty array of account IDs');
    }

    if (ids.length > 100) {
      return validationError('Cannot delete more than 100 accounts at once');
    }

    // Verify all accounts belong to this tenant
    const where = {
      id: { in: ids },
      ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
    };

    const count = await ctx.db.emailAccount.count({ where });
    if (count !== ids.length) {
      return validationError('Some accounts were not found or do not belong to your tenant');
    }

    // Delete social accounts first (cascade), then email accounts
    await ctx.db.$transaction([
      ctx.db.socialAccount.deleteMany({
        where: { emailAccountId: { in: ids } },
      }),
      ctx.db.emailAccount.deleteMany({ where }),
    ]);

    return success({ deleted: count });
  } catch (err) {
    console.error('POST /api/v1/accounts/bulk-delete error:', err);
    return error('INTERNAL_ERROR', 'Failed to delete accounts', 500);
  }
}
