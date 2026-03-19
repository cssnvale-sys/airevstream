import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot approve content');
    }

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        ...(ctx.tenantId ? { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } : {}),
      },
      select: { id: true, status: true },
    });

    if (!item) {
      return notFound('Content item not found');
    }

    const approvableStatuses = ['generated', 'pending_approval'];
    if (item.status === 'approved') {
      return error('ALREADY_APPROVED', 'Content item is already approved', 409);
    }
    if (!approvableStatuses.includes(item.status)) {
      return error('INVALID_STATE', `Cannot approve content with status "${item.status}"`, 409);
    }

    const [updated] = await ctx.db.$transaction([
      ctx.db.contentItem.update({
        where: { id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: ctx.userId,
        },
      }),
      ctx.db.actionAuditLog.create({
        data: {
          actionType: 'content.approve',
          tier: 1,
          parameters: { contentId: id },
          result: { status: 'approved' },
          status: 'completed',
        },
      }),
    ]);

    return success({
      ...updated,
      qualityScore: updated.qualityScore != null ? Number(updated.qualityScore) : null,
      durationSec: updated.durationSec != null ? Number(updated.durationSec) : null,
      approvalGateWindowHrs: updated.approvalGateWindowHrs != null ? Number(updated.approvalGateWindowHrs) : null,
    });
  } catch (err) {
    console.error('POST /api/v1/content/[id]/approve error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
