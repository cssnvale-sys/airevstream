import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const UpdateStoryboardSchema = z.object({
  status: z.enum(['draft', 'approved', 'in_production']).optional(),
  scriptJson: z.record(z.unknown()).optional(),
  soundPlanJson: z.record(z.unknown()).optional(),
  totalDurationSec: z.number().positive().optional(),
  fps: z.number().int().positive().optional(),
  aspectRatio: z.string().max(20).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (!ctx.tenantId) return forbidden('No tenant context');

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content/storyboard:get:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    // Verify the content item exists
    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true },
    });
    if (!item) {
      return notFound('Content item not found');
    }

    const storyboards = await ctx.db.storyboard.findMany({
      where: { contentId: id },
      include: {
        shots: {
          orderBy: { shotNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (storyboards.length === 0) {
      return notFound('No storyboard found for this content item');
    }

    // Return the most recent storyboard (first after desc ordering)
    const storyboard = storyboards[0];
    const converted = {
      ...storyboard,
      totalDurationSec: storyboard.totalDurationSec != null ? Number(storyboard.totalDurationSec) : null,
      shots: storyboard.shots?.map(shot => ({
        ...shot,
        startSec: Number(shot.startSec),
        endSec: Number(shot.endSec),
        qualityScore: shot.qualityScore != null ? Number(shot.qualityScore) : null,
        generationCost: shot.generationCost != null ? Number(shot.generationCost) : null,
      })) ?? [],
    };
    return success(converted);
  } catch (err) {
    console.error('GET /api/v1/content/[id]/storyboard error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch storyboard', 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

    if (!ctx.tenantId) return forbidden('No tenant context');

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content/storyboard:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    // Verify the content item exists
    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true },
    });
    if (!item) {
      return notFound('Content item not found');
    }

    // Find the most recent storyboard for this content item
    const storyboard = await ctx.db.storyboard.findFirst({
      where: { contentId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!storyboard) {
      return notFound('No storyboard found for this content item');
    }

    const body = await req.json();
    const parsed = UpdateStoryboardSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updateData[key] = value;
    }

    const updated = await ctx.db.storyboard.update({
      where: { id: storyboard.id },
      data: updateData,
      include: {
        shots: {
          orderBy: { shotNumber: 'asc' },
        },
      },
    });

    const converted = {
      ...updated,
      totalDurationSec: updated.totalDurationSec != null ? Number(updated.totalDurationSec) : null,
      shots: updated.shots?.map(shot => ({
        ...shot,
        startSec: Number(shot.startSec),
        endSec: Number(shot.endSec),
        qualityScore: shot.qualityScore != null ? Number(shot.qualityScore) : null,
        generationCost: shot.generationCost != null ? Number(shot.generationCost) : null,
      })) ?? [],
    };
    return success(converted);
  } catch (err) {
    console.error('PUT /api/v1/content/[id]/storyboard error:', err);
    return error('INTERNAL_ERROR', 'Failed to create storyboard', 500);
  }
}
