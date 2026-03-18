import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    // Verify the content item exists
    const item = await ctx.db.contentItem.findUnique({
      where: { id },
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
    return success(storyboards[0]);
  } catch (err) {
    console.error('GET /api/v1/content/[id]/storyboard error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    // Verify the content item exists
    const item = await ctx.db.contentItem.findUnique({
      where: { id },
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
    const { status, scriptJson, soundPlanJson, totalDurationSec, fps, aspectRatio } = body as {
      status?: string;
      scriptJson?: Record<string, unknown>;
      soundPlanJson?: Record<string, unknown>;
      totalDurationSec?: number;
      fps?: number;
      aspectRatio?: string;
    };

    const validStatuses = ['draft', 'approved', 'in_production'];
    if (status && !validStatuses.includes(status)) {
      return validationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (scriptJson !== undefined) updateData.scriptJson = scriptJson;
    if (soundPlanJson !== undefined) updateData.soundPlanJson = soundPlanJson;
    if (totalDurationSec !== undefined) updateData.totalDurationSec = totalDurationSec;
    if (fps !== undefined) updateData.fps = fps;
    if (aspectRatio !== undefined) updateData.aspectRatio = aspectRatio;

    const updated = await ctx.db.storyboard.update({
      where: { id: storyboard.id },
      data: updateData,
      include: {
        shots: {
          orderBy: { shotNumber: 'asc' },
        },
      },
    });

    return success(updated);
  } catch (err) {
    console.error('PUT /api/v1/content/[id]/storyboard error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
