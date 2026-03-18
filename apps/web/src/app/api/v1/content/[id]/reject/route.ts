import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

const RejectSchema = z.object({
  feedback: z.string().max(5000).optional(),
}).strict();

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

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

    const body = await req.json().catch(() => ({}));
    const parsed = RejectSchema.safeParse(body);
    const feedback = parsed.success ? parsed.data.feedback : undefined;

    const updated = await ctx.db.contentItem.update({
      where: { id },
      data: {
        status: 'draft',
      },
    });

    // Log rejection to audit log
    await ctx.db.actionAuditLog.create({
      data: {
        actionType: 'content.reject',
        tier: 1,
        parameters: {
          contentId: id,
          ...(feedback ? { feedback } : {}),
        },
        result: { previousStatus: item.status, newStatus: 'draft' },
        status: 'completed',
      },
    });

    return success({
      ...updated,
      qualityScore: updated.qualityScore != null ? Number(updated.qualityScore) : null,
      durationSec: updated.durationSec != null ? Number(updated.durationSec) : null,
      approvalGateWindowHrs: updated.approvalGateWindowHrs != null ? Number(updated.approvalGateWindowHrs) : null,
    });
  } catch (err) {
    console.error('POST /api/v1/content/[id]/reject error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
