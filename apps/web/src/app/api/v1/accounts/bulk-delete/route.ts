import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

/**
 * POST /api/v1/accounts/bulk-delete
 * Delete multiple email accounts by ID.
 * Body: { ids: string[] }
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`bulk-delete:${ip}:${ctx.userId}`, RATE_LIMITS.bulkOperation);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many bulk operations. Please try again later.', 429);
  }

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const body = await req.json();
    const parsed = BulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { ids } = parsed.data;

    // Verify all accounts belong to this tenant
    const where = {
      id: { in: ids },
      tenantId: ctx.tenantId,
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
