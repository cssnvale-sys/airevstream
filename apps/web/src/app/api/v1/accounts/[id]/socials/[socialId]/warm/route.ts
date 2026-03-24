import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string; socialId: string }> };

const WarmBodySchema = z.object({
  durationMinutes: z.number().int().min(1).max(120).optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot warm accounts');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`account-warm:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id, socialId } = await params;
    if (!isUUID(id) || !isUUID(socialId)) return error('VALIDATION_ERROR', 'Invalid ID format', 400);

    let body: z.infer<typeof WarmBodySchema> = {};
    try {
      const raw = await req.json();
      body = WarmBodySchema.parse(raw);
    } catch {
      // Body is optional — defaults are fine
    }

    const emailAccount = await ctx.db.emailAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!emailAccount) return notFound('Email account not found');

    const socialAccount = await ctx.db.socialAccount.findFirst({
      where: { id: socialId, emailAccountId: id },
      select: { id: true },
    });
    if (!socialAccount) return notFound('Social account not found');

    const job = await addJob('account', 'account:warm', {
      socialAccountId: socialId,
      durationMinutes: body.durationMinutes,
    });

    return success({ jobId: job.id, message: 'Warm-up started' });
  } catch (err) {
    console.error('POST /api/v1/accounts/[id]/socials/[socialId]/warm error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
