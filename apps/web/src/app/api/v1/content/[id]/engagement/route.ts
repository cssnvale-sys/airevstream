import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, authenticateAny, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

const EngagementSchema = z.object({
  views: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  watchTimeMinutes: z.number().min(0).optional(),
  clickThroughRate: z.number().min(0).max(100).optional(),
}).strict();

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticateAny(req, 'read');
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid content ID format');

    const content = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: {
        id: true,
        status: true,
        performance: true,
        title: true,
      },
    });

    if (!content) return notFound('Content item not found');

    const performance = (content.performance as Record<string, unknown>) ?? {};

    return success({
      contentId: content.id,
      title: content.title,
      status: content.status,
      engagement: {
        views: performance.views ?? 0,
        likes: performance.likes ?? 0,
        comments: performance.comments ?? 0,
        shares: performance.shares ?? 0,
        watchTimeMinutes: performance.watchTimeMinutes ?? 0,
        clickThroughRate: performance.clickThroughRate ?? 0,
      },
      lastUpdated: performance.lastUpdated ?? null,
    });
  } catch (err) {
    console.error('GET /api/v1/content/[id]/engagement failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch engagement data', 500);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot update engagement data');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`engagement:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid content ID format');

    const body = await req.json();
    const parsed = EngagementSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues.map(i => i.message).join(', '));

    const content = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true, performance: true },
    });

    if (!content) return notFound('Content item not found');

    const existing = (content.performance as Record<string, unknown>) ?? {};
    const updated = {
      ...existing,
      ...parsed.data,
      lastUpdated: new Date().toISOString(),
    };

    await ctx.db.contentItem.update({
      where: { id },
      data: { performance: updated as any },
    });

    return success({ contentId: id, engagement: updated });
  } catch (err) {
    console.error('POST /api/v1/content/[id]/engagement failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update engagement data', 500);
  }
}
