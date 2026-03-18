import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string; action: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id, action } = await params;
  if (!['approve', 'reject'].includes(action)) {
    return error('VALIDATION_ERROR', 'Action must be approve or reject', 400);
  }

  try {
    // Tenant-scoped lookup: only allow approve/reject on this tenant's content
    const content = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
    });
    if (!content) return error('NOT_FOUND', 'Content not found', 404);

    if (action === 'approve') {
      await ctx.db.contentItem.update({
        where: { id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: ctx.userId,
        },
      });
    } else {
      let feedback: string | undefined;
      try {
        const body = await req.json();
        feedback = body.feedback;
      } catch {
        // no body
      }

      await ctx.db.contentItem.update({
        where: { id },
        data: { status: 'draft' },
      });
    }

    return success({ id, action, status: action === 'approve' ? 'approved' : 'draft' });
  } catch (err) {
    console.error(`POST /approvals/${id}/${action} failed:`, err);
    return error('INTERNAL_ERROR', `Failed to ${action} content`, 500);
  }
}
