import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, isUUID } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const RejectBodySchema = z.object({
  feedback: z.string().max(2000).optional(),
});

type RouteParams = { params: Promise<{ id: string; action: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`approvals/[id]/[action]:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id, action } = await params;
  if (!isUUID(id)) return error('VALIDATION_ERROR', 'Invalid ID format', 400);
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
        const parsed = RejectBodySchema.safeParse(body);
        if (parsed.success) {
          feedback = parsed.data.feedback;
        }
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
