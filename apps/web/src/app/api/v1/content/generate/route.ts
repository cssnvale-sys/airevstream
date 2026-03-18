import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';

const GenerateContentSchema = z.object({
  channelId: z.string().uuid(),
  title: z.string().max(500).optional().nullable(),
  contentType: z.string().min(1).max(50),
  contentPurpose: z.string().max(100).optional().nullable(),
  prompt: z.string().max(10000).optional().nullable(),
  language: z.string().max(10).optional().default('en'),
  affiliateProductId: z.string().uuid().optional().nullable(),
  affiliateMode: z.string().max(50).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const rl = checkRateLimit(`generate:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many generation requests', 429);
    }

    const body = await req.json();
    const parsed = GenerateContentSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const {
      channelId,
      title,
      contentType,
      contentPurpose,
      prompt,
      language,
      affiliateProductId,
      affiliateMode,
    } = parsed.data;

    // Verify the channel exists and belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id: channelId,
        ...(ctx.tenantId ? { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } : {}),
      },
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

    try {
      await addJob('content', 'content:generate', {
        contentId: contentItem.id,
        channelId,
        contentType,
        prompt: prompt ?? undefined,
      });
    } catch (jobErr) {
      // If job enqueue fails, roll back content status so it doesn't stay stuck in 'generating'
      console.error('Failed to enqueue content generation job:', jobErr);
      await ctx.db.contentItem.update({
        where: { id: contentItem.id },
        data: { status: 'failed' },
      });
      return error('QUEUE_ERROR', 'Failed to start content generation', 500);
    }

    return success(contentItem, { queued: true });
  } catch (err) {
    console.error('POST /api/v1/content/generate error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
