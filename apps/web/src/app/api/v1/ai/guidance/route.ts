import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface GuidanceSuggestion {
  type: 'info' | 'warning' | 'improvement';
  category: string;
  message: string;
  action?: { label: string; patch: Record<string, unknown> };
}

export async function POST(req: NextRequest) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`ai-guidance:POST:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const body = await req.json();
    const { shotSpec } = body;

    const suggestions: GuidanceSuggestion[] = [];

    if (shotSpec) {
      const camera = shotSpec.camera ?? {};
      const generation = shotSpec.generation ?? {};
      const promptBlocks = shotSpec.promptBlocks ?? [];

      // Camera suggestions
      if (camera.framing === 'close-up' && camera.lens === '24mm') {
        suggestions.push({
          type: 'warning',
          category: 'camera',
          message: 'Wide lens (24mm) on a close-up may cause distortion. Consider switching to 85mm for natural portraits.',
          action: { label: 'Switch to 85mm', patch: { camera: { ...camera, lens: '85mm' } } },
        });
      }

      if (camera.framing === 'wide' && camera.lens === '135mm') {
        suggestions.push({
          type: 'warning',
          category: 'camera',
          message: 'Telephoto lens (135mm) on a wide shot may compress perspective too much. Consider 24mm or 35mm.',
          action: { label: 'Switch to 35mm', patch: { camera: { ...camera, lens: '35mm' } } },
        });
      }

      // Generation suggestions
      if (generation.steps && generation.steps < 15) {
        suggestions.push({
          type: 'warning',
          category: 'quality',
          message: 'Very low step count may produce noisy results. Minimum 20 steps recommended.',
          action: { label: 'Set to 25 steps', patch: { generation: { ...generation, steps: 25 } } },
        });
      }

      if (generation.cfg && generation.cfg > 15) {
        suggestions.push({
          type: 'info',
          category: 'quality',
          message: 'High CFG scale (>15) can cause over-saturated images. 5-10 is usually optimal.',
          action: { label: 'Set CFG to 7', patch: { generation: { ...generation, cfg: 7 } } },
        });
      }

      // Prompt suggestions
      if (promptBlocks.length === 0) {
        suggestions.push({
          type: 'warning',
          category: 'prompt',
          message: 'No prompt blocks defined. The shot needs at least one prompt block for generation.',
        });
      }

      // Duration suggestions
      if (shotSpec.duration && shotSpec.duration < 2) {
        suggestions.push({
          type: 'info',
          category: 'timing',
          message: 'Very short shot duration (< 2s). Consider extending for better pacing.',
        });
      }

      // Audio suggestions
      if (!shotSpec.audioPlan) {
        suggestions.push({
          type: 'improvement',
          category: 'audio',
          message: 'No audio plan specified. Consider adding background music or narration.',
        });
      }
    }

    return success({ suggestions });
  } catch (err) {
    logger.error('POST /api/v1/ai/guidance failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to generate guidance', 500);
  }
}
