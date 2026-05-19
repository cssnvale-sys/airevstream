import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const generateBrandingSchema = z.object({
  type: z.enum(['logo', 'banner', 'profile']),
  prompt: z.string().max(2000).optional().nullable(),
  params: z.record(z.unknown()).optional().default({}),
});

/**
 * POST /api/v1/channels/[id]/branding/generate
 * Queue branding asset generation via ComfyUI.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`channels-branding-generate:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    const body = await req.json();
    const parsed = generateBrandingSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { type, prompt, params: genParams } = parsed.data;

    // Find or create branding package for this channel
    let branding = await ctx.db.brandingPackage.findFirst({
      where: { channelId: id },
    });

    if (!branding) {
      branding = await ctx.db.brandingPackage.create({
        data: {
          channelId: id,
          colors: {} as Prisma.InputJsonValue,
          fonts: {} as Prisma.InputJsonValue,
          templates: [] as any,
        },
      });
    }

    // Queue the generation job
    await addJob('production', 'production:asset-generate', {
      tenantId: ctx.tenantId!,
      assetType: 'branding',
      sourceModelId: branding.id,
      workflowType: type === 'logo' ? 'thumbnail' : 'scenery',
      prompt: prompt ?? 'Generate channel branding',
      params: genParams as Record<string, unknown>,
      channelId: id,
    });

    return success({ queued: true });
  } catch (err) {
    logger.error('POST /api/v1/channels/[id]/branding/generate error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to queue branding generation', 500);
  }
}
