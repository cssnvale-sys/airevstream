import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';
import { matchTrends } from '@airevstream/shared';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);

    // Fetch trending topics from knowledge base
    const entries = await ctx.db.knowledgeBaseEntry.findMany({
      where: {
        tenantId: ctx.tenantId!,
        category: 'trends',
        ...(platform ? { content: { contains: platform } } : {}),
      },
      orderBy: [
        { relevanceScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        relevanceScore: true,
        createdAt: true,
      },
    });

    // Optionally match against a content query
    const query = searchParams.get('q');
    let matchedTrends: Array<{ topic: string; relevanceScore: number; matchedKeywords: string[] }> | undefined;

    if (query) {
      matchedTrends = matchTrends(
        query,
        entries.map(e => ({ topic: e.title, relevanceScore: Number(e.relevanceScore ?? 5) })),
      );
    }

    return success({
      trends: entries.map(e => ({
        id: e.id,
        topic: e.title,
        description: e.content?.slice(0, 200),
        relevanceScore: Number(e.relevanceScore ?? 0),
        discoveredAt: e.createdAt.toISOString(),
      })),
      matchedTrends,
      platform,
    });
  } catch (err) {
    console.error('[GET /trending]', err);
    return error('INTERNAL_ERROR', 'Failed to fetch trending topics', 500);
  }
}
