import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError } from '@/lib/api-server';
import { generateText, createServiceRegistry } from '@airevstream/ai-client';

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const { channelId, topic, contentType, platforms, duration, affiliateProductId } = body;

    if (!channelId || !topic) {
      return validationError('channelId and topic are required');
    }

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
  } catch (err: any) {
    console.error('[POST /content/generate-script]', err);
    return error('INTERNAL_ERROR', 'Failed to generate script', 500);
  }
}
