import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, authenticateAny, success, error, notFound, validationError } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

const UpdateContentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum([
    'draft', 'generating', 'generated', 'pending_approval',
    'approved', 'scheduled', 'posted', 'archived', 'failed',
  ]).optional(),
  prompt: z.string().max(10000).optional(),
  platformMetadata: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticateAny(req, 'read');
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
    const parsed = UpdateContentSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const { title, status, prompt, platformMetadata } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (platformMetadata !== undefined) updateData.platformMetadata = platformMetadata as any;

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

/**
 * DELETE /api/v1/content/[id]
 * Delete a content item. Only allowed for draft or archived status.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        ...(ctx.tenantId ? { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } : {}),
      },
      select: { id: true, status: true },
    });

    if (!item) return notFound('Content item not found');

    // Only allow deletion of draft or archived content
    const deletableStatuses = ['draft', 'archived', 'failed'];
    if (!deletableStatuses.includes(item.status)) {
      return validationError(
        `Cannot delete content with status "${item.status}". Only draft, archived, or failed content can be deleted.`,
      );
    }

    // Cascade: storyboard shots, storyboards, scheduled posts, then content
    await ctx.db.$transaction([
      ctx.db.storyboardShot.deleteMany({
        where: { storyboard: { contentId: id } },
      }),
      ctx.db.storyboard.deleteMany({ where: { contentId: id } }),
      ctx.db.scheduledPost.deleteMany({ where: { contentId: id } }),
      ctx.db.contentItem.delete({ where: { id } }),
    ]);

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/content/[id] error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
