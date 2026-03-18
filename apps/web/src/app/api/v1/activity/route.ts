import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@airevstream/db';
import { authenticate, success, error, parseQuery } from '@/lib/api-server';

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { limit } = parseQuery(req);
    const db = getDb();

    // Aggregate recent activity from multiple sources
    const [recentContent, recentPosts, recentAlerts] = await Promise.all([
      db.contentItem.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: { id: true, title: true, status: true, contentType: true, updatedAt: true, channel: { select: { name: true } } },
      }),
      db.scheduledPost.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: { id: true, status: true, platform: true, scheduledAt: true, updatedAt: true, channel: { select: { name: true } } },
      }),
      db.alert.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 5),
        select: { id: true, title: true, severity: true, category: true, createdAt: true },
      }),
    ]);

    // Merge and sort by date
    const activity = [
      ...recentContent.map((c) => ({
        id: c.id,
        type: 'content' as const,
        message: `${c.channel.name}: "${c.title ?? 'Untitled'}" → ${c.status}`,
        timestamp: c.updatedAt.toISOString(),
      })),
      ...recentPosts.map((p) => ({
        id: p.id,
        type: 'posting' as const,
        message: `${p.channel.name}: ${p.platform} post ${p.status}`,
        timestamp: p.updatedAt.toISOString(),
      })),
      ...recentAlerts.map((a) => ({
        id: a.id,
        type: 'alert' as const,
        message: `[${a.severity}] ${a.title}`,
        timestamp: a.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return success(activity);
  } catch (err: any) {
    console.error('[GET /activity]', err);
    return error('INTERNAL_ERROR', 'Failed to load activity', 500);
  }
}
