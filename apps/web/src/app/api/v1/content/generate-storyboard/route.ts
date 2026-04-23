import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, notFound, forbidden, formatZodErrors } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { generateJSON } from '@airevstream/ai-client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const GenerateStoryboardSchema = z.object({
  script: z.string().min(1).max(50000),
  channelId: z.string().uuid().optional().nullable(),
  contentType: z.string().max(50).optional().nullable(),
  duration: z.number().int().positive().optional().nullable(),
});

interface GeneratedShot {
  shotNumber: number;
  section: string;
  description: string;
  duration: number;
  cameraAngle: string;
}

const STORYBOARD_SYSTEM_PROMPT = `You are a video storyboard director. Given a script, break it into shots following the H.I.C.C. structure (Hook, Intro, Content, CTA). Return a JSON object with a "shots" array. Each shot must have: shotNumber (int), section (HOOK|INTRO|CONTENT|CTA), description (visual description of the shot), duration (seconds, int), and cameraAngle (e.g. "medium close-up", "wide establishing", "over-the-shoulder", "close-up detail"). Aim for 4-12 shots depending on script length. Keep total duration reasonable for the content type.`;

/** Fallback: generate placeholder shots when AI is unavailable */
function generateFallbackShots(contentType: string | null | undefined): GeneratedShot[] {
  const sections = ['HOOK', 'INTRO', 'CONTENT', 'CTA'];
  return sections.map((section, i) => ({
    shotNumber: i + 1,
    section,
    description: `${section} segment - ${contentType ?? 'video'} frame`,
    duration: section === 'HOOK' ? 5 : section === 'INTRO' ? 25 : section === 'CTA' ? 10 : 20,
    cameraAngle: i % 2 === 0 ? 'medium close-up' : 'wide establishing',
  }));
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const rl = checkRateLimit(`gen:storyboard:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many generation requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = GenerateStoryboardSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { script, channelId, contentType, duration } = parsed.data;

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

    // Generate storyboard shots via AI, with fallback
    let generatedShots: GeneratedShot[];
    try {
      const durationHint = duration ? ` Target total duration: ~${duration} seconds.` : '';
      const typeHint = contentType ? ` Content type: ${contentType}.` : '';
      const prompt = `Break this script into storyboard shots.${typeHint}${durationHint}\n\nScript:\n${script}`;

      const result = await generateJSON<{ shots: GeneratedShot[] }>(prompt, {
        systemPrompt: STORYBOARD_SYSTEM_PROMPT,
        temperature: 0.7,
      });

      if (result.shots && Array.isArray(result.shots) && result.shots.length > 0) {
        generatedShots = result.shots.map((shot, i) => ({
          shotNumber: shot.shotNumber ?? i + 1,
          section: shot.section ?? 'CONTENT',
          description: shot.description ?? `Shot ${i + 1}`,
          duration: typeof shot.duration === 'number' ? shot.duration : 10,
          cameraAngle: shot.cameraAngle ?? 'medium close-up',
        }));
      } else {
        generatedShots = generateFallbackShots(contentType);
      }
    } catch (aiErr) {
      logger.error('[generate-storyboard] AI generation failed, using fallback', aiErr as Error);
      generatedShots = generateFallbackShots(contentType);
    }

    const shots = generatedShots.map((shot) => ({
      id: `shot-${shot.shotNumber}`,
      ...shot,
      imageUrl: null,
      status: 'pending',
    }));

    return success({ shots });
  } catch (err) {
    logger.error('[POST /content/generate-storyboard]', err as Error);
    return error('INTERNAL_ERROR', 'Failed to generate storyboard', 500);
  }
}
