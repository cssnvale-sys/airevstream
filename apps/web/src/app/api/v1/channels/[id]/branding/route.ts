import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const upsertBrandingSchema = z.object({
  logoUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  colors: z.record(z.unknown()).optional().default({}),
  fonts: z.record(z.unknown()).optional().default({}),
  templates: z.array(z.unknown()).optional().default([]),
});

/**
 * GET /api/v1/channels/[id]/branding
 * Get branding package for a channel.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

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

    const branding = await ctx.db.brandingPackage.findFirst({
      where: { channelId: id },
    });

    // Branding can be null (no package yet) — that's a valid state
    return success(branding);
  } catch (err) {
    logger.error('GET /api/v1/channels/[id]/branding error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch branding package', 500);
  }
}

/**
 * PUT /api/v1/channels/[id]/branding
 * Upsert branding package for a channel.
 * Uses findFirst + create/update since BrandingPackage has no unique constraint on channelId.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`channels-branding:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
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
    const parsed = upsertBrandingSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { logoUrl, bannerUrl, colors, fonts, templates } = parsed.data;

    const data = {
      logoUrl: logoUrl ?? null,
      bannerUrl: bannerUrl ?? null,
      colors: colors as any,
      fonts: fonts as any,
      templates: templates as any,
    };

    // findFirst + create/update pattern (no unique constraint on channelId)
    const existing = await ctx.db.brandingPackage.findFirst({
      where: { channelId: id },
    });

    let branding;
    if (existing) {
      branding = await ctx.db.brandingPackage.update({
        where: { id: existing.id },
        data,
      });
    } else {
      branding = await ctx.db.brandingPackage.create({
        data: {
          channelId: id,
          ...data,
        },
      });
    }

    return success(branding);
  } catch (err) {
    logger.error('PUT /api/v1/channels/[id]/branding error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update branding package', 500);
  }
}
