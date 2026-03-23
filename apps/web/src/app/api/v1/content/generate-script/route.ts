import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, notFound, forbidden } from '@/lib/api-server';
import { generateText, createServiceRegistry } from '@airevstream/ai-client';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const GenerateScriptSchema = z.object({
  channelId: z.string().uuid(),
  topic: z.string().min(1).max(1000),
  contentType: z.string().max(50).optional().nullable(),
  platforms: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  duration: z.number().int().min(5).max(3600).optional().nullable(),
  affiliateProductId: z.string().uuid().optional().nullable(),
  affiliateMode: z.string().max(50).optional().nullable(),
}).strict();

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const rl = checkRateLimit(`gen:script:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many generation requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = GenerateScriptSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { channelId, topic, contentType, platforms, duration, affiliateProductId } = parsed.data;

    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id: channelId,
        ...(ctx.tenantId ? { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } : {}),
      },
      select: { id: true },
    });
    if (!channel) return notFound('Channel not found');

    const durationSec = duration ?? 60;
    const format = contentType ?? 'video';

    const prompt = `Write a ${format} script about "${topic}" using the H.I.C.C. (Hook, Intro, Content, CTA) structure.

Requirements:
- Target duration: ${durationSec} seconds
- Format each section with [HOOK], [INTRO], [CONTENT], [CTA] headers
- Include timing markers (e.g., "(0-5s)")
- Add [MICRO-HOOK] transitions between content segments to maintain engagement
- Make the hook attention-grabbing and curiosity-driven
- Keep the CTA specific and actionable
${affiliateProductId ? `- Include an [AFFILIATE] section at the end mentioning the product naturally` : ''}
${platforms ? `- Optimize tone for: ${Array.isArray(platforms) ? platforms.join(', ') : platforms}` : ''}

Return ONLY the script text, no extra commentary.`;

    let script: string;
    let model = 'unknown';

    try {
      const registry = createServiceRegistry(ctx.db);
      const result = await registry.generate({
        type: 'text',
        task: 'script_generation',
        prompt,
        systemPrompt: 'You are an expert social media scriptwriter. Write engaging scripts using the H.I.C.C. framework.',
      });
      script = result.content;
      model = result.model;
    } catch {
      try {
        const result = await generateText(prompt, {
          systemPrompt: 'You are an expert social media scriptwriter. Write engaging scripts using the H.I.C.C. framework.',
        });
        script = result.content;
        model = result.model;
      } catch (aiErr) {
        console.error('AI script generation failed:', aiErr);
        return error('SERVICE_UNAVAILABLE', 'AI service is not available. Please ensure Ollama is running.', 503);
      }
    }

    return success({ script, model });
  } catch (err) {
    console.error('[POST /content/generate-script]', err);
    return error('INTERNAL_ERROR', 'Failed to generate script', 500);
  }
}
