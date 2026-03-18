import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const item = await ctx.db.contentItem.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!item) {
      return notFound('Content item not found');
    }

    if (item.status === 'approved') {
      return error('ALREADY_APPROVED', 'Content item is already approved', 409);
    }

    const updated = await ctx.db.contentItem.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: ctx.userId,
      },
    });

    // Log approval to audit log
    await ctx.db.actionAuditLog.create({
      data: {
        actionType: 'content.approve',
        tier: 1,
        parameters: { contentId: id },
        result: { status: 'approved' },
        status: 'completed',
      },
    });

    return success(updated);
  } catch (err) {
    console.error('POST /api/v1/content/[id]/approve error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
