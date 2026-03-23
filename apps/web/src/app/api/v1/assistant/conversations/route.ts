import { authenticate, error, paginated, parseQuery } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/assistant/conversations
 * List conversations (paginated).
 * Query: search?, contextPage?
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, search, params } = parseQuery(req);
    const contextPage = params.get('contextPage') ?? undefined;

    const where: Record<string, unknown> = { tenantId: ctx.tenantId };
    if (contextPage) where.contextPage = contextPage;
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const [conversations, total] = await Promise.all([
      ctx.db.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          contextPage: true,
          modelUsed: true,
          messageCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      ctx.db.conversation.count({ where }),
    ]);

    return paginated(conversations, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/assistant/conversations error:', err);
    return error('INTERNAL_ERROR', 'Failed to list conversations', 500);
  }
}
