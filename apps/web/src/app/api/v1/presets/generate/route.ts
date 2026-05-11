import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden, formatZodErrors } from '@/lib/api-server';
import { generateText, createServiceRegistry } from '@airevstream/ai-client';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { PRESET_GENERATION_SYSTEM_PROMPT, validateAndNormalizeAiPreset } from '@airevstream/shared';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const GeneratePresetSchema = z.object({
  description: z.string().min(3).max(500),
});

/**
 * POST /api/v1/presets/generate
 * Generate a preset from a natural language description.
 * Returns a preview — does NOT save to DB.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const rl = checkRateLimit(`gen:preset:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many generation requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = GeneratePresetSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { description } = parsed.data;

    const prompt = `Generate a cinema pipeline preset for: "${description}"`;
    let content: string;
    let model = 'unknown';

    try {
      const registry = createServiceRegistry(ctx.db);
      const result = await registry.generate({
        type: 'text',
        task: 'preset_generation',
        prompt,
        systemPrompt: PRESET_GENERATION_SYSTEM_PROMPT,
        format: 'json',
        temperature: 0.7,
      });
      content = result.content;
      model = result.model;
    } catch (registryErr) {
      logger.error('Service registry generation failed, falling back to direct generateText', registryErr as Error);
      try {
        const result = await generateText(prompt, {
          systemPrompt: PRESET_GENERATION_SYSTEM_PROMPT,
        });
        content = result.content;
        model = result.model;
      } catch (aiErr) {
        logger.error('AI preset generation failed', aiErr as Error);
        return error('SERVICE_UNAVAILABLE', 'AI service is not available. Please ensure Ollama is running.', 503);
      }
    }

    // Parse the AI response as JSON
    let rawPreset: unknown;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
      rawPreset = JSON.parse(cleaned);
    } catch (err) {
      logger.error('AI returned non-JSON content', err instanceof Error ? err : new Error(content));
      return error('AI_PARSE_ERROR', 'AI returned invalid JSON. Please try again with a different description.', 422);
    }

    // Validate and normalize
    const result = validateAndNormalizeAiPreset(rawPreset, description);
    if ('error' in result) {
      logger.error('AI preset validation failed', new Error(result.error));
      return error('AI_VALIDATION_ERROR', 'AI generated an invalid preset. Please try again.', 422);
    }

    return success({ preset: result.preset, model });
  } catch (err) {
    logger.error('POST /api/v1/presets/generate error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to generate preset', 500);
  }
}
