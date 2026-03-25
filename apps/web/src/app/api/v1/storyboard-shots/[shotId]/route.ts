import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ shotId: string }> };

const UpdateShotSchema = z.object({
  shotspec: z.record(z.unknown()).optional(),
  status: z.enum(['pending', 'generating', 'generated', 'approved', 'failed']).optional(),
});

/**
 * GET /api/v1/storyboard-shots/[shotId]
 * Get a single storyboard shot by ID.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { shotId } = await params;
    if (!isUUID(shotId)) return validationError('Invalid shot ID format');

    const shot = await ctx.db.storyboardShot.findFirst({
      where: {
        id: shotId,
        storyboard: {
          content: {
            channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
          },
        },
      },
      include: {
        storyboard: {
          select: { id: true, contentId: true, status: true },
        },
      },
    });

    if (!shot) return notFound('Shot not found');

    return success({
      ...shot,
      startSec: Number(shot.startSec),
      endSec: Number(shot.endSec),
      qualityScore: shot.qualityScore != null ? Number(shot.qualityScore) : null,
      generationCost: shot.generationCost != null ? Number(shot.generationCost) : null,
    });
  } catch (err) {
    console.error('GET /api/v1/storyboard-shots/[shotId] error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch shot', 500);
  }
}

/**
 * PUT /api/v1/storyboard-shots/[shotId]
 * Update a storyboard shot's properties (shotspec, status).
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`storyboard-shots:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const { shotId } = await params;
    if (!isUUID(shotId)) return validationError('Invalid shot ID format');

    // Verify shot exists and belongs to tenant
    const existing = await ctx.db.storyboardShot.findFirst({
      where: {
        id: shotId,
        storyboard: {
          content: {
            channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
          },
        },
      },
      select: { id: true },
    });

    if (!existing) return notFound('Shot not found');

    const body = await req.json();
    const parsed = UpdateShotSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.shotspec !== undefined) updateData.shotspec = parsed.data.shotspec as any;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

    const updated = await ctx.db.storyboardShot.update({
      where: { id: shotId },
      data: updateData,
    });

    return success({
      ...updated,
      startSec: Number(updated.startSec),
      endSec: Number(updated.endSec),
      qualityScore: updated.qualityScore != null ? Number(updated.qualityScore) : null,
      generationCost: updated.generationCost != null ? Number(updated.generationCost) : null,
    });
  } catch (err) {
    console.error('PUT /api/v1/storyboard-shots/[shotId] error:', err);
    return error('INTERNAL_ERROR', 'Failed to update shot', 500);
  }
}
