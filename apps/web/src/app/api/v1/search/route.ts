import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const SEARCH_RESULTS_PER_TYPE = 5;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const ip = getClientIp(req);
    const rl = checkRateLimit(`search:${ip}:${ctx.userId}`, { maxAttempts: 60, windowMs: 60 * 1000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return success({ content: [], channels: [], accounts: [] });
    }

    const tenantWhere = { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } };

    const [content, channels, accounts] = await Promise.all([
      ctx.db.contentItem.findMany({
        where: {
          ...tenantWhere,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { prompt: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, contentType: true, status: true },
        take: SEARCH_RESULTS_PER_TYPE,
        orderBy: { updatedAt: 'desc' },
      }),
      ctx.db.channel.findMany({
        where: {
          socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true, socialAccount: { select: { platform: true } } },
        take: SEARCH_RESULTS_PER_TYPE,
        orderBy: { name: 'asc' },
      }),
      ctx.db.socialAccount.findMany({
        where: {
          emailAccount: { tenantId: ctx.tenantId },
          username: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, username: true, platform: true },
        take: SEARCH_RESULTS_PER_TYPE,
        orderBy: { username: 'asc' },
      }),
    ]);

    const flatChannels = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      platform: ch.socialAccount.platform,
    }));

    return success({ content, channels: flatChannels, accounts });
  } catch (err) {
    console.error('GET /api/v1/search error:', err);
    return error('INTERNAL_ERROR', 'Search failed', 500);
  }
}
