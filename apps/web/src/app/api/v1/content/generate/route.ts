import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError } from '@/lib/api-server';
import { addJob } from '@airevstream/queue';

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const body = await req.json();
    const {
      channelId,
      title,
      contentType,
      contentPurpose,
      prompt,
      language,
      affiliateProductId,
      affiliateMode,
    } = body as {
      channelId?: string;
      title?: string;
      contentType?: string;
      contentPurpose?: string;
      prompt?: string;
      language?: string;
      affiliateProductId?: string;
      affiliateMode?: string;
    };

    if (!channelId) {
      return validationError('channelId is required');
    }
    if (!contentType) {
      return validationError('contentType is required');
    }

    // Verify the channel exists
    const channel = await ctx.db.channel.findUnique({
      where: { id: channelId },
      select: { id: true },
    });
    if (!channel) {
      return error('NOT_FOUND', 'Channel not found', 404);
    }

    // If an affiliate product is specified, verify it exists
    if (affiliateProductId) {
      const product = await ctx.db.affiliateProduct.findUnique({
        where: { id: affiliateProductId },
        select: { id: true },
      });
      if (!product) {
        return error('NOT_FOUND', 'Affiliate product not found', 404);
      }
    }

    const contentItem = await ctx.db.contentItem.create({
      data: {
        channelId,
        title: title ?? null,
        contentType,
        contentPurpose: contentPurpose ?? null,
        prompt: prompt ?? null,
        language: language ?? 'en',
        affiliateProductId: affiliateProductId ?? null,
        affiliateMode: affiliateMode ?? null,
        status: 'generating',
      },
    });

    await addJob('content', 'content:generate', {
      contentId: contentItem.id,
      channelId,
      contentType,
      prompt: prompt ?? undefined,
    });

    return success(contentItem, { queued: true });
  } catch (err) {
    console.error('POST /api/v1/content/generate error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
