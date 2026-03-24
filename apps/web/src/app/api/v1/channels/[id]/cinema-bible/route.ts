import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const UpdateCinemaBibleSchema = z.object({
  lookBible: z.record(z.unknown()).optional(),
  characterBible: z.record(z.unknown()).optional(),
  environmentBible: z.record(z.unknown()).optional(),
  promptBible: z.record(z.unknown()).optional(),
  shotspecTemplate: z.record(z.unknown()).optional(),
}).strict().refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one bible section must be provided',
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/channels/[id]/cinema-bible
 * Get the latest cinema bible for a channel
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    const cinemaBible = await ctx.db.cinemaBible.findFirst({
      where: { channelId: id },
      orderBy: { version: 'desc' },
    });

    if (!cinemaBible) return notFound('No cinema bible found for this channel');

    return success(cinemaBible);
  } catch (err) {
    console.error('GET cinema-bible failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch cinema bible', 500);
  }
}

/**
 * PUT /api/v1/channels/[id]/cinema-bible
 * Update or create a cinema bible for a channel
 * Creates a new version if one already exists
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`channels-cinema-bible:PUT:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    const body = await req.json();
    const parsed = UpdateCinemaBibleSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => e.message).join(', '));
    }
    const { lookBible, characterBible, environmentBible, promptBible, shotspecTemplate } = parsed.data;

    // Use interactive transaction to prevent TOCTOU race on version
    const cinemaBible = await ctx.db.$transaction(async (tx) => {
      const latestBible = await tx.cinemaBible.findFirst({
        where: { channelId: id },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });

      if (latestBible) {
        // Update existing latest bible
        const data: Record<string, unknown> = {};
        if (lookBible !== undefined) data.lookBible = lookBible;
        if (characterBible !== undefined) data.characterBible = characterBible;
        if (environmentBible !== undefined) data.environmentBible = environmentBible;
        if (promptBible !== undefined) data.promptBible = promptBible;
        if (shotspecTemplate !== undefined) data.shotspecTemplate = shotspecTemplate;

        return tx.cinemaBible.update({
          where: { id: latestBible.id },
          data,
        });
      } else {
        // Create first cinema bible for this channel
        return tx.cinemaBible.create({
          data: {
            channelId: id,
            version: 1,
            lookBible: (lookBible ?? {}) as any,
            characterBible: (characterBible ?? {}) as any,
            environmentBible: (environmentBible ?? {}) as any,
            promptBible: (promptBible ?? {}) as any,
            shotspecTemplate: (shotspecTemplate ?? {}) as any,
          },
        });
      }
    });

    return success(cinemaBible);
  } catch (err) {
    console.error('PUT cinema-bible failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update cinema bible', 500);
  }
}
