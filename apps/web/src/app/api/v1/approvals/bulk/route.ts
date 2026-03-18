import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError } from '@/lib/api-server';

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const body = await req.json();
    const { ids, action } = body as { ids?: string[]; action?: string };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return validationError('ids must be a non-empty array of content item IDs');
    }

    if (action !== 'approve' && action !== 'reject') {
      return validationError('action must be either "approve" or "reject"');
    }

    // Verify all content items exist
    const items = await ctx.db.contentItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });

    if (items.length !== ids.length) {
      const foundIds = new Set(items.map((i) => i.id));
      const missingIds = ids.filter((id) => !foundIds.has(id));
      return error('NOT_FOUND', `Content items not found: ${missingIds.join(', ')}`, 404);
    }

    const now = new Date();
    const results: { id: string; status: string }[] = [];

    if (action === 'approve') {
      await ctx.db.contentItem.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'approved',
          approvedAt: now,
          approvedBy: ctx.userId,
        },
      });

      // Log each approval to audit log
      await ctx.db.actionAuditLog.createMany({
        data: ids.map((contentId) => ({
          actionType: 'content.bulk_approve',
          tier: 1,
          parameters: { contentId },
          result: { status: 'approved' },
          status: 'completed',
        })),
      });

      for (const id of ids) {
        results.push({ id, status: 'approved' });
      }
    } else {
      // reject
      await ctx.db.contentItem.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'draft',
        },
      });

      // Log each rejection to audit log
      await ctx.db.actionAuditLog.createMany({
        data: ids.map((contentId) => ({
          actionType: 'content.bulk_reject',
          tier: 1,
          parameters: { contentId },
          result: { previousStatus: 'pending_approval', newStatus: 'draft' },
          status: 'completed',
        })),
      });

      for (const id of ids) {
        results.push({ id, status: 'draft' });
      }
    }

    return success({
      action,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error('POST /api/v1/approvals/bulk error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
