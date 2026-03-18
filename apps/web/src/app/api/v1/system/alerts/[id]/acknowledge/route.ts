import { authenticate, success, error, notFound } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/system/alerts/[id]/acknowledge
 * Acknowledge an alert (set acknowledgedAt=now, status='acknowledged').
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const existing = await ctx.db.alert.findUnique({ where: { id } });
    if (!existing) return notFound('Alert not found');

    if (existing.status === 'resolved') {
      return success({ message: 'Alert is already resolved', alert: existing });
    }

    const updated = await ctx.db.alert.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      },
    });

    return success(updated);
  } catch (err) {
    console.error('POST /api/v1/system/alerts/[id]/acknowledge error:', err);
    return error('INTERNAL_ERROR', 'Failed to acknowledge alert', 500);
  }
}
