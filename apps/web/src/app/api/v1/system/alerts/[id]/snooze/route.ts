import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, isUUID, validationError } from '@/lib/api-server';

const SnoozeSchema = z.object({
  duration: z.number().positive().max(86400).optional(),
}).strict();

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const alert = await ctx.db.alert.findUnique({ where: { id } });
    if (!alert) return error('NOT_FOUND', 'Alert not found', 404);

    let duration = 3600; // default 1 hour
    try {
      const body = await req.json();
      const parsed = SnoozeSchema.safeParse(body);
      if (parsed.success && parsed.data.duration != null) {
        duration = parsed.data.duration;
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
