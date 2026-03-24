import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, notFound, forbidden } from '@/lib/api-server';
import { addJob } from '@airevstream/queue';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const GenerateShotSchema = z.object({
  shotId: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  channelId: z.string().uuid().optional().nullable(),
  workflowType: z.string().max(50).optional().default('storyboard-frame'),
}).strict();

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const rl = checkRateLimit(`gen:shot:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many generation requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = GenerateShotSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { shotId, description, channelId, workflowType } = parsed.data;

    if (!ctx.tenantId) {
      return forbidden('No tenant context');
    }

    // Verify channel belongs to tenant (if channelId provided)
    if (channelId) {
      const channel = await ctx.db.channel.findFirst({
        where: {
          id: channelId,
          socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
        },
        select: { id: true },
      });
      if (!channel) return notFound('Channel not found');
    }

    // Queue a ComfyUI image generation job via BullMQ
    const job = await addJob('production', 'production:generate-image', {
      shotId,
      channelId: channelId ?? undefined,
      workflowType,
      params: {
        prompt: description,
        shotId,
      },
    });

    return success({
      shotId,
      jobId: job.id,
      status: 'generating',
      message: 'Shot generation queued',
    });
  } catch (err) {
    console.error('[POST /content/generate-shot]', err);
    return error('INTERNAL_ERROR', 'Failed to queue shot generation', 500);
  }
}
