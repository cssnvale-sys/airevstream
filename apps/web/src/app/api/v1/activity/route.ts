import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, parseQuery } from '@/lib/api-server';

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { limit } = parseQuery(req);

    // Tenant scoping for content/posts
    const tenantChannelScope = {
      channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
    };

    // Aggregate recent activity from multiple sources
    const [recentContent, recentPosts, recentAlerts] = await Promise.all([
      ctx.db.contentItem.findMany({
        where: tenantChannelScope,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: { id: true, title: true, status: true, contentType: true, updatedAt: true, channel: { select: { name: true } } },
      }),
      ctx.db.scheduledPost.findMany({
        where: tenantChannelScope,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: { id: true, status: true, platform: true, scheduledAt: true, updatedAt: true, channel: { select: { name: true } } },
      }),
      // Alerts are system-level (no tenant chain in schema)
      ctx.db.alert.findMany({
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
  } catch (err) {
    console.error('GET /api/v1/activity failed:', err);
    return error('INTERNAL_ERROR', 'Failed to load activity', 500);
  }
}
