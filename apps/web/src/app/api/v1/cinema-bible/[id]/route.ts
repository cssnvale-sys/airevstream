import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

const UpdateCinemaBibleSchema = z.object({
  lookBible: z.record(z.unknown()).optional(),
  characterBible: z.record(z.unknown()).optional(),
  environmentBible: z.record(z.unknown()).optional(),
  promptBible: z.record(z.unknown()).optional(),
  shotspecTemplate: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/cinema-bible/[id]
 * Get a single cinema bible by ID. Scoped through channel chain.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  // Unconditional tenant guard (D076)
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const bible = await ctx.db.cinemaBible.findFirst({
      where: { id, channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            socialAccount: {
              select: { platform: true, username: true },
            },
          },
        },
      },
    });

    if (!bible) {
      return notFound('Cinema bible not found');
    }

    return success(bible);
  } catch (err) {
    logger.error('GET /api/v1/cinema-bible/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch cinema bible', 500);
  }
}

/**
 * PUT /api/v1/cinema-bible/[id]
 * Update a cinema bible. Only JSON bible fields can be updated.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  // Unconditional tenant guard (D076)
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`cinema-bible/[id]:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify ownership through tenant chain
    const existing = await ctx.db.cinemaBible.findFirst({
      where: { id, channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } },
    });

    if (!existing) {
      return notFound('Cinema bible not found');
    }

    const body = await req.json();
    const parsed = UpdateCinemaBibleSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.lookBible !== undefined) updateData.lookBible = parsed.data.lookBible as any;
    if (parsed.data.characterBible !== undefined) updateData.characterBible = parsed.data.characterBible as any;
    if (parsed.data.environmentBible !== undefined) updateData.environmentBible = parsed.data.environmentBible as any;
    if (parsed.data.promptBible !== undefined) updateData.promptBible = parsed.data.promptBible as any;
    if (parsed.data.shotspecTemplate !== undefined) updateData.shotspecTemplate = parsed.data.shotspecTemplate as any;

    const bible = await ctx.db.cinemaBible.update({
      where: { id },
      data: updateData,
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            socialAccount: {
              select: { platform: true, username: true },
            },
          },
        },
      },
    });

    return success(bible);
  } catch (err) {
    logger.error('PUT /api/v1/cinema-bible/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update cinema bible', 500);
  }
}
