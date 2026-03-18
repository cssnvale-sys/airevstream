import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, paginated, parseQuery, validationError } from '@/lib/api-server';
import type { Prisma } from '@prisma/client';

const createEntrySchema = z.object({
  domain: z.string().min(1).max(50),
  category: z.string().max(100).optional().nullable(),
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  sourceUrl: z.string().url().optional().nullable(),
  relevanceScore: z.number().min(0).max(10).optional().nullable(),
});

/**
 * GET /api/v1/knowledge-base
 * List knowledge base entries with filtering, search, and pagination.
 *
 * Query params:
 *   - domain: filter by domain
 *   - category: filter by category
 *   - search: full-text search on title + content
 *   - isCurrent: filter by current status ("true" or "false")
 *   - page, limit: pagination
 *   - sort, order: sorting
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, sort, order, search, params } = parseQuery(req);

    const domain = params.get('domain') ?? undefined;
    const category = params.get('category') ?? undefined;
    const isCurrentParam = params.get('isCurrent') ?? undefined;

    const where: Prisma.KnowledgeBaseEntryWhereInput = {};

    if (domain) {
      where.domain = domain;
    }
    if (category) {
      where.category = category;
    }
    if (isCurrentParam !== undefined) {
      where.isCurrent = isCurrentParam === 'true';
    }

    // Full-text search on title + content using PostgreSQL text search
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'title', 'domain', 'relevanceScore'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [entries, total] = await Promise.all([
      ctx.db.knowledgeBaseEntry.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.knowledgeBaseEntry.count({ where }),
    ]);

    return paginated(entries, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/knowledge-base error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch knowledge base entries', 500);
  }
}

/**
 * POST /api/v1/knowledge-base
 * Create a new knowledge base entry.
 *
 * Body: { domain, category?, title, content, sourceUrl?, relevanceScore? }
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = createEntrySchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { domain, category, title, content, sourceUrl, relevanceScore } = parsed.data;

    const entry = await ctx.db.knowledgeBaseEntry.create({
      data: {
        domain,
        category: category ?? null,
        title,
        content,
        sourceUrl: sourceUrl ?? null,
        relevanceScore: relevanceScore ?? null,
        isCurrent: true,
      },
    });

    return success(entry);
  } catch (err) {
    console.error('POST /api/v1/knowledge-base error:', err);
    return error('INTERNAL_ERROR', 'Failed to create knowledge base entry', 500);
  }
}
