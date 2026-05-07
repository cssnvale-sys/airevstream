import { authenticate, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

const VALID_SLOTS = ['face', 'waist', 'body_front', 'body_back'] as const;

const GenerateAvatarSchema = z.object({
  slot: z.enum(VALID_SLOTS),
  prompt: z.string().min(1).max(2000),
  params: z.record(z.unknown()).optional(),
});

/**
 * POST /api/v1/avatars/[id]/generate
 * Queue a ComfyUI avatar image generation job
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const ctx = authResult;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`avatars/[id]/generate:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const body = await req.json();
    const parsed = GenerateAvatarSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { slot, prompt, params: genParams } = parsed.data;

    const avatar = await ctx.db.avatar.findFirst({
      where: { id, tenantId: ctx.tenantId! },
    });
    if (!avatar) return notFound('Avatar not found');

    await addJob('production', 'production:asset-generate', {
      tenantId: ctx.tenantId!,
      assetType: 'avatar',
      sourceModelId: avatar.id,
      workflowType: 'avatar',
      prompt,
      params: genParams ?? {},
      slot,
    });

    return success({ queued: true, jobName: 'production:asset-generate' });
  } catch (err) {
    logger.error('POST /api/v1/avatars/[id]/generate failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to queue avatar generation', 500);
  }
}
