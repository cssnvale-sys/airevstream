import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        ...(ctx.tenantId ? { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } : {}),
      },
      include: {
        channel: {
          select: { id: true, name: true, primaryLanguage: true, niches: true, tone: true },
        },
        aiService: {
          select: { id: true, name: true, provider: true, serviceType: true },
        },
        affiliateProduct: {
          select: { id: true, name: true, url: true, category: true },
        },
        storyboards: {
          include: {
            shots: {
              orderBy: { shotNumber: 'asc' },
            },
          },
        },
        scheduledPosts: {
          orderBy: { scheduledAt: 'asc' },
        },
        children: {
          select: {
            id: true,
            version: true,
            status: true,
            title: true,
            createdAt: true,
          },
          orderBy: { version: 'asc' },
        },
      },
    });

    if (!item) {
      return notFound('Content item not found');
    }

    // Convert Decimal fields to numbers
    const converted = {
      ...item,
      qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
      durationSec: item.durationSec != null ? Number(item.durationSec) : null,
      approvalGateWindowHrs: item.approvalGateWindowHrs != null ? Number(item.approvalGateWindowHrs) : null,
      storyboards: item.storyboards.map((sb) => ({
        ...sb,
        shots: sb.shots.map((shot) => ({
          ...shot,
          startSec: Number(shot.startSec),
          endSec: Number(shot.endSec),
          qualityScore: shot.qualityScore != null ? Number(shot.qualityScore) : null,
          generationCost: shot.generationCost != null ? Number(shot.generationCost) : null,
        })),
      })),
    };

    return success(converted);
  } catch (err) {
    console.error('GET /api/v1/content/[id] error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const existing = await ctx.db.contentItem.findFirst({
      where: {
        id,
        ...(ctx.tenantId ? { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } : {}),
      },
      select: { id: true },
    });
    if (!existing) {
      return notFound('Content item not found');
    }

    const body = await req.json();
    const { title, status, prompt, platformMetadata } = body as {
      title?: string;
      status?: string;
      prompt?: string;
      platformMetadata?: Record<string, unknown>;
    };

    // Validate status if provided
    const validStatuses = [
      'draft', 'generating', 'generated', 'pending_approval',
      'approved', 'scheduled', 'posted', 'archived', 'failed',
    ];
    if (status && !validStatuses.includes(status)) {
      return validationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (platformMetadata !== undefined) updateData.platformMetadata = platformMetadata;

    const updated = await ctx.db.contentItem.update({
      where: { id },
      data: updateData,
      include: {
        channel: {
          select: { id: true, name: true },
        },
        aiService: {
          select: { id: true, name: true },
        },
      },
    });

    return success({
      ...updated,
      qualityScore: updated.qualityScore != null ? Number(updated.qualityScore) : null,
      durationSec: updated.durationSec != null ? Number(updated.durationSec) : null,
      approvalGateWindowHrs: updated.approvalGateWindowHrs != null ? Number(updated.approvalGateWindowHrs) : null,
    });
  } catch (err) {
    console.error('PUT /api/v1/content/[id] error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
