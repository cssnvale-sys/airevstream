import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, authenticateAny, success, error, paginated, parseQuery, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const SuggestionEntrySchema = z.object({
  presetId: z.string().min(1).max(100),
  dimension: z.string().min(1).max(30),
  reason: z.string().min(1),
  expectedImprovement: z.enum(['minor', 'moderate', 'significant']),
});

const LogSuggestionsSchema = z.object({
  contentId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  suggestions: z.array(SuggestionEntrySchema).min(1).max(20),
  viralScoreBefore: z.number().int().min(0).max(100).optional(),
});

/**
 * GET /api/v1/suggestions
 * List suggestion logs (paginated, filterable)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { page, limit, skip, params } = parseQuery(req);
  const channelId = params.get('channelId') ?? undefined;
  const outcome = params.get('outcome') ?? undefined;
  const presetId = params.get('presetId') ?? undefined;

  try {
    const where: Record<string, unknown> = { tenantId: ctx.tenantId };
    if (channelId) where.channelId = channelId;
    if (outcome) where.outcome = outcome;
    if (presetId) where.presetId = presetId;

    const [logs, total] = await Promise.all([
      ctx.db.suggestionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          channel: { select: { id: true, name: true } },
          content: { select: { id: true, title: true } },
        },
      }),
      ctx.db.suggestionLog.count({ where }),
    ]);

    return paginated(logs, total, page, limit);
  } catch (err) {
    logger.error('GET /api/v1/suggestions failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to list suggestions', 500);
  }
}

/**
 * POST /api/v1/suggestions
 * Log a batch of shown suggestions
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot log suggestions');
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`suggestions:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

  try {
    const body = await req.json();
    const parsed = LogSuggestionsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues[0].message);

    const { contentId, channelId, suggestions, viralScoreBefore } = parsed.data;

    // Use individual creates inside a transaction to get back IDs reliably
    const logs = await ctx.db.$transaction(
      suggestions.map((s) =>
        ctx.db.suggestionLog.create({
          data: {
            tenantId: ctx.tenantId!,
            contentId: contentId ?? null,
            channelId: channelId ?? null,
            presetId: s.presetId,
            dimension: s.dimension,
            reason: s.reason,
            expectedImprovement: s.expectedImprovement,
            outcome: 'shown',
            viralScoreBefore: viralScoreBefore ?? null,
          },
          select: { id: true, presetId: true },
        }),
      ),
    );

    return success({ count: logs.length, logs });
  } catch (err) {
    logger.error('POST /api/v1/suggestions failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to log suggestions', 500);
  }
}
