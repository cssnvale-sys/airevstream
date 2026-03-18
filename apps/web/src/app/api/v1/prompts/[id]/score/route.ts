import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

const scoreSchema = z.object({
  score: z.number().min(0).max(10),
}).strict();

/**
 * POST /api/v1/prompts/[id]/score
 * Record a quality score for a prompt usage.
 * Updates the prompt's avgScore as a running average.
 *
 * Body: { score: number (0-10) }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.promptTemplate.findUnique({ where: { id } });
    if (!existing) {
      return notFound('Prompt template not found');
    }

    const body = await req.json();
    const parsed = scoreSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { score } = parsed.data;

    // Compute running average:
    // If there's no existing avgScore, the new score becomes the average.
    // Otherwise: newAvg = ((oldAvg * usageCount) + newScore) / (usageCount + 1)
    const currentAvg = existing.avgScore ? Number(existing.avgScore) : 0;
    const currentCount = existing.usageCount;

    let newAvg: number;
    if (currentCount === 0 && !existing.avgScore) {
      // First score ever recorded
      newAvg = score;
    } else {
      // Running average: weight the existing average by the count of scores recorded so far.
      // We use usageCount as proxy for how many scores have been recorded.
      // If usageCount is 0 but avgScore exists, treat it as 1 previous score.
      const effectiveCount = currentCount > 0 ? currentCount : 1;
      newAvg = ((currentAvg * effectiveCount) + score) / (effectiveCount + 1);
    }

    // Round to 1 decimal place to match Decimal(3,1) precision
    newAvg = Math.round(newAvg * 10) / 10;

    const updated = await ctx.db.promptTemplate.update({
      where: { id },
      data: {
        avgScore: newAvg,
        usageCount: { increment: 1 },
      },
    });

    return success({
      id: updated.id,
      name: updated.name,
      avgScore: Number(updated.avgScore),
      usageCount: updated.usageCount,
      recordedScore: score,
    });
  } catch (err) {
    console.error('POST /api/v1/prompts/[id]/score error:', err);
    return error('INTERNAL_ERROR', 'Failed to record prompt score', 500);
  }
}
