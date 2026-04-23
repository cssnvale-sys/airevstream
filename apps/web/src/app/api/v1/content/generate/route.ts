import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden, formatZodErrors , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

    const rl = checkRateLimit(`generate:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many generation requests', 429);
    }

    const body = await req.json();
    const parsed = GenerateContentSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
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

    if (!ctx.tenantId) {
      return forbidden('No tenant context');
    }

    // Verify the channel exists and belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id: channelId,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
      select: { id: true },
    });
    if (!channel) {
      return error('NOT_FOUND', 'Channel not found', 404);
    }

    // If an affiliate product is specified, verify it exists and is linked to a tenant channel
    if (affiliateProductId) {
      const product = await ctx.db.affiliateProduct.findFirst({
        where: {
          id: affiliateProductId,
          channelPools: {
            some: {
              channel: {
                socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
              },
            },
          },
        },
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
      logger.error('Failed to enqueue content generation job', jobErr as Error);
      await ctx.db.contentItem.update({
        where: { id: contentItem.id },
        data: { status: 'failed' },
      });
      return error('QUEUE_ERROR', 'Failed to start content generation', 500);
    }

    return success({
      ...contentItem,
      qualityScore: contentItem.qualityScore != null ? Number(contentItem.qualityScore) : null,
      durationSec: contentItem.durationSec != null ? Number(contentItem.durationSec) : null,
      approvalGateWindowHrs: contentItem.approvalGateWindowHrs != null ? Number(contentItem.approvalGateWindowHrs) : null,
    }, { queued: true });
  } catch (err) {
    logger.error('POST /api/v1/content/generate error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to generate content', 500);
  }
}
