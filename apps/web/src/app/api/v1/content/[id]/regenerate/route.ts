import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound } from '@/lib/api-server';
import { addJob } from '@airevstream/queue';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const existing = await ctx.db.contentItem.findFirst({
      where: {
        id,
        ...(ctx.tenantId ? { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } : {}),
      },
      select: {
        id: true,
        channelId: true,
        title: true,
        contentType: true,
        contentPurpose: true,
        prompt: true,
        language: true,
        generationParams: true,
        affiliateProductId: true,
        affiliateMode: true,
        version: true,
        parentId: true,
        languageFamilyId: true,
      },
    });

    if (!existing) {
      return notFound('Content item not found');
    }

    // Determine the root parent ID for the version chain
    const rootId = existing.parentId ?? existing.id;

    const newVersion = await ctx.db.contentItem.create({
      data: {
        channelId: existing.channelId,
        title: existing.title,
        contentType: existing.contentType,
        contentPurpose: existing.contentPurpose,
        prompt: existing.prompt,
        language: existing.language,
        generationParams: existing.generationParams ?? {},
        affiliateProductId: existing.affiliateProductId,
        affiliateMode: existing.affiliateMode,
        languageFamilyId: existing.languageFamilyId,
        version: existing.version + 1,
        parentId: rootId,
        status: 'generating',
      },
    });

    await addJob('content', 'content:generate', {
      contentId: newVersion.id,
      channelId: existing.channelId,
      contentType: existing.contentType,
      prompt: existing.prompt ?? undefined,
    });

    return success(newVersion, { queued: true });
  } catch (err) {
    console.error('POST /api/v1/content/[id]/regenerate error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
