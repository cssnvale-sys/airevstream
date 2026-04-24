import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, paginated, parseQuery, validationError, forbidden } from '@/lib/api-server';
import type { Prisma } from '@prisma/client';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const createPromptSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(50),
  platform: z.string().max(20).optional().nullable(),
  contentType: z.string().max(30).optional().nullable(),
  template: z.string().min(1).max(50000),
  negativePrompt: z.string().max(10000).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
});

/**
 * GET /api/v1/prompts
 * List prompt templates with filtering, search, and pagination.
 *
 * Query params:
 *   - category: filter by category (hook, intro, content, cta, thumbnail, description)
 *   - platform: filter by platform (youtube, tiktok, instagram, facebook)
 *   - contentType: filter by content type
 *   - search: search in name and template text
 *   - tags: comma-separated list of tags to filter by
 *   - sortBy: usageCount, avgScore, createdAt (default: createdAt)
 *   - page, limit: pagination
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { page, limit, skip, sort, order, search, params } = parseQuery(req);

    const category = params.get('category') ?? undefined;
    const platform = params.get('platform') ?? undefined;
    const contentType = params.get('contentType') ?? undefined;
    const tagsParam = params.get('tags') ?? undefined;
    const sortBy = params.get('sortBy') ?? undefined;

    const validCategories = ['hook', 'intro', 'content', 'cta', 'thumbnail', 'description'];
    const validPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
    const validContentTypes = ['video_short', 'video_long', 'image', 'text', 'voice', 'thumbnail'];

    const where: Prisma.PromptTemplateWhereInput = { tenantId: ctx.tenantId };

    if (category && validCategories.includes(category)) {
      where.category = category;
    }
    if (platform && validPlatforms.includes(platform)) {
      where.platform = platform;
    }
    if (contentType && validContentTypes.includes(contentType)) {
      where.contentType = contentType;
    }
    if (tagsParam) {
      const tagList = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        where.tags = { hasSome: tagList };
      }
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { template: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Determine sort field
    const allowedSortFields = ['usageCount', 'avgScore', 'createdAt', 'updatedAt', 'name'];
    let sortField: string;
    if (sortBy && allowedSortFields.includes(sortBy)) {
      sortField = sortBy;
    } else if (allowedSortFields.includes(sort)) {
      sortField = sort;
    } else {
      sortField = 'createdAt';
    }
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [templates, total] = await Promise.all([
      ctx.db.promptTemplate.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.promptTemplate.count({ where }),
    ]);

    const converted = templates.map(t => ({
      ...t,
      avgScore: t.avgScore != null ? Number(t.avgScore) : null,
    }));

    return paginated(converted, total, page, limit);
  } catch (err) {
    logger.error('GET /api/v1/prompts error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch prompt templates', 500);
  }
}

/**
 * POST /api/v1/prompts
 * Create a new prompt template.
 *
 * Body: { name, category, platform?, contentType?, template, negativePrompt?, tags?, metadata? }
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`prompts:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = createPromptSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { name, category, platform, contentType, template, negativePrompt, tags, metadata } = parsed.data;

    const promptTemplate = await ctx.db.promptTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        category,
        platform: platform ?? null,
        contentType: contentType ?? null,
        template,
        negativePrompt: negativePrompt ?? null,
        tags,
        metadata: (metadata ?? {}) as any,
      },
    });

    const converted = {
      ...promptTemplate,
      avgScore: promptTemplate.avgScore != null ? Number(promptTemplate.avgScore) : null,
    };

    return success(converted);
  } catch (err) {
    logger.error('POST /api/v1/prompts error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to create prompt template', 500);
  }
}
