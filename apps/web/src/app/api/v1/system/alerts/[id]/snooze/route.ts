import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const alert = await ctx.db.alert.findUnique({ where: { id } });
    if (!alert) return error('NOT_FOUND', 'Alert not found', 404);

    let duration = 3600; // default 1 hour
    try {
      const body = await req.json();
      if (body.duration != null) {
        const d = Number(body.duration);
        if (Number.isFinite(d) && d > 0 && d <= 86400) {
          duration = d;
        }
      }
    } catch {
      // no body — use default duration
    }

    await ctx.db.alert.update({
      where: { id },
      data: {
        status: 'suppressed',
        acknowledgedAt: new Date(),
      },
    });

    return success({ id, snoozedUntil: new Date(Date.now() + duration * 1000).toISOString() });
  } catch (err) {
    console.error(`[POST /system/alerts/${id}/snooze]`, err);
    return error('INTERNAL_ERROR', 'Failed to snooze alert', 500);
  }
}
