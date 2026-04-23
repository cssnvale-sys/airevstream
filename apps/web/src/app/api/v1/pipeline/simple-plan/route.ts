import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden, formatZodErrors } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { generateText, generateJSON, createServiceRegistry } from '@airevstream/ai-client';
import { SIMPLE_MODE_GUARDRAILS } from '@airevstream/shared';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const SimplePlanSchema = z.object({
  topic: z.string().min(3).max(500),
  stylePreset: z.string().max(100).optional().nullable(),
  durationSeconds: z.number().int().min(5).max(60).default(30),
  channelId: z.string().uuid(),
  emotion: z.string().max(50).optional().nullable(),
  setting: z.string().max(200).optional().nullable(),
  characterDescription: z.string().max(200).optional().nullable(),
  hasSpeaking: z.boolean().optional().nullable(),
});

interface PlanShot {
  shotNumber: number;
  section: string;
  description: string;
  duration: number;
  cameraAngle: string;
}

const DIRECTOR_SYSTEM_PROMPT = `You are a creative director for short-form video content. Given a topic and constraints, generate a concise concept with title, logline, and visual direction. Return a JSON object with: title (string), concept (string, 1-2 sentences), visualDirection (string, style keywords). Be creative but practical.`;

const STORYBOARD_SYSTEM_PROMPT = `You are a storyboard planner for short-form video. Given a concept, break it into shots following the H.I.C.C. structure (Hook, Intro, Content, CTA). Return a JSON object with a "shots" array. Each shot must have: shotNumber (int), section (HOOK|INTRO|CONTENT|CTA), description (visual description), duration (seconds, int), cameraAngle (e.g. "medium close-up", "wide establishing"). Keep total duration close to the target. Maximum shots: ${SIMPLE_MODE_GUARDRAILS.MAX_SHOTS}. Max shot duration: ${SIMPLE_MODE_GUARDRAILS.MAX_SHOT_DURATION_SEC}s.`;

function generateFallbackPlan(topic: string, durationSeconds: number, emotion?: string | null) {
  const shotCount = Math.min(Math.ceil(durationSeconds / 5), SIMPLE_MODE_GUARDRAILS.MAX_SHOTS);
  const sections = ['HOOK', 'INTRO', ...Array(Math.max(1, shotCount - 3)).fill('CONTENT'), 'CTA'];
  const totalSections = sections.slice(0, shotCount);
  const shotDuration = Math.floor(durationSeconds / totalSections.length);

  const shots: PlanShot[] = totalSections.map((section, i) => ({
    shotNumber: i + 1,
    section,
    description: `${section} segment — ${topic}`,
    duration: i === totalSections.length - 1 ? durationSeconds - shotDuration * i : shotDuration,
    cameraAngle: i % 2 === 0 ? 'medium close-up' : 'wide establishing',
  }));

  return {
    title: topic,
    concept: `A ${emotion ?? 'dynamic'} video about ${topic}`,
    visualDirection: emotion ?? 'cinematic',
    shots,
    totalDuration: durationSeconds,
    sceneCount: Math.ceil(shots.length / 3),
  };
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`simple-plan:POST:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = SimplePlanSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { topic, stylePreset, durationSeconds, channelId, emotion, setting, characterDescription, hasSpeaking } = parsed.data;

    // Enforce simple mode max duration
    const clampedDuration = Math.min(durationSeconds, Math.max(...SIMPLE_MODE_GUARDRAILS.ALLOWED_DURATIONS));

    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: { id: channelId, socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true, name: true },
    });
    if (!channel) return error('NOT_FOUND', 'Channel not found', 404);

    // Phase 1: Director — generate concept
    const directorPrompt = [
      `Create a short-form video concept about: "${topic}"`,
      `Target duration: ${clampedDuration} seconds`,
      stylePreset ? `Visual style: ${stylePreset}` : '',
      emotion ? `Mood/tone: ${emotion}` : '',
      setting ? `Setting: ${setting}` : '',
      characterDescription ? `Character: ${characterDescription}` : '',
      hasSpeaking === false ? 'No spoken dialogue — visuals and music only' : '',
    ].filter(Boolean).join('\n');

    let title = topic;
    let concept = `A ${emotion ?? 'dynamic'} video about ${topic}`;
    let visualDirection = stylePreset ?? 'cinematic';

    try {
      const registry = createServiceRegistry(ctx.db);
      const directorResult = await registry.generate({
        type: 'text',
        task: 'script_generation',
        prompt: directorPrompt,
        systemPrompt: DIRECTOR_SYSTEM_PROMPT + ' Return valid JSON only.',
        maxTokens: 512,
      });
      const parsed = JSON.parse(directorResult.content);
      title = parsed.title ?? title;
      concept = parsed.concept ?? concept;
      visualDirection = parsed.visualDirection ?? visualDirection;
    } catch (directorErr) {
      logger.error('[simple-plan] Director agent failed, falling back to direct', directorErr as Error);
      try {
        const result = await generateText(directorPrompt, {
          systemPrompt: DIRECTOR_SYSTEM_PROMPT,
        });
        const parsed = JSON.parse(result.content);
        title = parsed.title ?? title;
        concept = parsed.concept ?? concept;
        visualDirection = parsed.visualDirection ?? visualDirection;
      } catch (fallbackErr) {
        logger.error('[simple-plan] Direct AI fallback also failed', fallbackErr as Error);
      }
    }

    // Phase 2: Storyboard planner — break into shots
    const maxShots = SIMPLE_MODE_GUARDRAILS.MAX_SHOTS;
    const maxShotDuration = SIMPLE_MODE_GUARDRAILS.MAX_SHOT_DURATION_SEC;
    const storyboardPrompt = [
      `Break this concept into storyboard shots:`,
      `Title: ${title}`,
      `Concept: ${concept}`,
      `Visual direction: ${visualDirection}`,
      `Target duration: ${clampedDuration} seconds`,
      `Max shots: ${maxShots}`,
      `Max shot duration: ${maxShotDuration} seconds`,
      characterDescription ? `Character: ${characterDescription}` : '',
      setting ? `Setting: ${setting}` : '',
      hasSpeaking === false ? 'No dialogue — visuals and music only' : '',
    ].filter(Boolean).join('\n');

    let shots: PlanShot[];
    try {
      const result = await generateJSON<{ shots: PlanShot[] }>(storyboardPrompt, {
        systemPrompt: STORYBOARD_SYSTEM_PROMPT,
        temperature: 0.7,
      });

      if (result.shots && Array.isArray(result.shots) && result.shots.length > 0) {
        // Apply simple mode constraints server-side
        shots = result.shots.slice(0, maxShots).map((shot, i) => ({
          shotNumber: shot.shotNumber ?? i + 1,
          section: shot.section ?? 'CONTENT',
          description: shot.description ?? `Shot ${i + 1}`,
          duration: Math.min(typeof shot.duration === 'number' ? shot.duration : 5, maxShotDuration),
          cameraAngle: shot.cameraAngle ?? 'medium close-up',
        }));
      } else {
        shots = generateFallbackPlan(topic, clampedDuration, emotion).shots;
      }
    } catch (sbErr) {
      logger.error('[simple-plan] Storyboard agent failed, using fallback', sbErr as Error);
      shots = generateFallbackPlan(topic, clampedDuration, emotion).shots;
    }

    // Clamp total duration
    const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);

    return success({
      title,
      concept,
      visualDirection,
      shots,
      totalDuration,
      sceneCount: new Set(shots.map(s => s.section)).size,
      shotCount: shots.length,
      constraints: {
        maxShots,
        maxShotDuration: maxShotDuration,
        maxDuration: clampedDuration,
      },
    });
  } catch (err) {
    logger.error('POST /api/v1/pipeline/simple-plan failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to generate simple plan', 500);
  }
}
