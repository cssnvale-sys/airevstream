import { NextRequest, NextResponse } from 'next/server';
import { authenticateAny, success, error, notFound, isUUID, validationError } from '@/lib/api-server';
import { matchTrends } from '@airevstream/shared';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/channels/[id]/topic-suggestions
 * Cross-reference channel niches with trending topics via matchTrends()
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel belongs to tenant, get niches + identity
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
      select: {
        id: true,
        name: true,
        niches: true,
        tone: true,
        targetAudience: true,
        socialAccount: { select: { platform: true } },
      },
    });
    if (!channel) return notFound('Channel not found');

    // Build content text from channel niches + identity for trend matching
    const contentParts: string[] = [];
    if (channel.niches.length > 0) contentParts.push(channel.niches.join(' '));
    if (channel.tone) contentParts.push(channel.tone);
    if (channel.targetAudience) contentParts.push(channel.targetAudience);
    const contentText = contentParts.join(' ');

    if (!contentText.trim()) {
      return success({ suggestions: [], message: 'Add niches to your channel to get topic suggestions' });
    }

    // Fetch trending topics from KnowledgeBaseEntry
    const trendEntries = await ctx.db.knowledgeBaseEntry.findMany({
      where: {
        tenantId: ctx.tenantId,
        category: 'trends',
      },
      select: {
        title: true,
        content: true,
        relevanceScore: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Convert to trending topics format
    const trendingTopics = trendEntries.map((entry) => ({
      topic: entry.title,
      relevanceScore: entry.relevanceScore != null ? Number(entry.relevanceScore) : 0.5,
    }));

    if (trendingTopics.length === 0) {
      return success({ suggestions: [], message: 'No trending topics found. Run the research worker to ingest trends.' });
    }

    // Use matchTrends from viral-scoring.ts — deterministic, no LLM
    const matches = matchTrends(contentText, trendingTopics);

    const suggestions = matches.slice(0, 10).map((m) => ({
      topic: m.topic,
      relevanceScore: m.relevanceScore,
      matchedKeywords: m.matchedKeywords,
      channelNiches: channel.niches,
    }));

    return success({
      suggestions,
      channelId: channel.id,
      channelName: channel.name,
      platform: channel.socialAccount?.platform ?? null,
    });
  } catch (err) {
    logger.error('GET /api/v1/channels/[id]/topic-suggestions failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch topic suggestions', 500);
  }
}
