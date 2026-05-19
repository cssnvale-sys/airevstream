import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, notFound, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

const CINEMA_BIBLES_LIMIT = 100;

export const dynamic = 'force-dynamic';

const CreateCinemaBibleSchema = z.object({
  channelId: z.string().uuid(),
  lookBible: z.record(z.unknown()).optional().default({}),
  characterBible: z.record(z.unknown()).optional().default({}),
  environmentBible: z.record(z.unknown()).optional().default({}),
  promptBible: z.record(z.unknown()).optional().default({}),
  shotspecTemplate: z.record(z.unknown()).optional().default({}),
});

/**
 * GET /api/v1/cinema-bible
 * List all cinema bibles for the tenant, scoped through channel chain.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  // Unconditional tenant guard (D076)
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const bibles = await ctx.db.cinemaBible.findMany({
      where: { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } },
      orderBy: { updatedAt: 'desc' },
      take: CINEMA_BIBLES_LIMIT,
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

    return success(bibles);
  } catch (err) {
    logger.apiError('METHOD', 'PATH', err as Error, { userId: ctx?.userId });
    return error('INTERNAL_ERROR', 'Failed to fetch cinema bibles', 500);
  }
}

/**
 * POST /api/v1/cinema-bible
 * Create a new cinema bible. Requires channelId (must belong to tenant).
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  // Unconditional tenant guard (D076)
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`cinema-bible:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = CreateCinemaBibleSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { channelId, lookBible, characterBible, environmentBible, promptBible, shotspecTemplate } = parsed.data;

    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: { id: channelId, socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
    });
    if (!channel) {
      return notFound('Channel not found');
    }

    const bible = await ctx.db.cinemaBible.create({
      data: {
        channelId,
        lookBible: lookBible as Prisma.InputJsonValue,
        characterBible: characterBible as Prisma.InputJsonValue,
        environmentBible: environmentBible as Prisma.InputJsonValue,
        promptBible: promptBible as Prisma.InputJsonValue,
        shotspecTemplate: shotspecTemplate as Prisma.InputJsonValue,
      },
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
    logger.apiError('METHOD', 'PATH', err as Error, { userId: ctx?.userId });
    return error('INTERNAL_ERROR', 'Failed to create cinema bible', 500);
  }
}
