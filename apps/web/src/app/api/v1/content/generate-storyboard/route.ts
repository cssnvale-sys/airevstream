import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const GenerateStoryboardSchema = z.object({
  script: z.string().min(1).max(50000),
  channelId: z.string().uuid().optional().nullable(),
  contentType: z.string().max(50).optional().nullable(),
}).strict();

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const rl = checkRateLimit(`gen:storyboard:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many generation requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = GenerateStoryboardSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { script, channelId, contentType } = parsed.data;

    // Parse H.I.C.C. sections from script to generate shots
    const sections = ['HOOK', 'INTRO', 'CONTENT', 'CTA'];
    const shots = sections.map((section, i) => ({
      id: `shot-${i + 1}`,
      shotNumber: i + 1,
      section,
      description: `${section} segment - ${contentType ?? 'video'} frame`,
      duration: section === 'HOOK' ? 5 : section === 'INTRO' ? 25 : section === 'CTA' ? 10 : 20,
      cameraAngle: i % 2 === 0 ? 'medium close-up' : 'wide establishing',
      imageUrl: null,
      status: 'pending',
    }));

    return success({ shots });
  } catch (err) {
    console.error('[POST /content/generate-storyboard]', err);
    return error('INTERNAL_ERROR', 'Failed to generate storyboard', 500);
  }
}
