import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, validationError, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VERSIONS_LIST_LIMIT = 100;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (!ctx.tenantId) return forbidden('No tenant context');

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content/versions:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true, parentId: true },
    });

    if (!item) {
      return notFound('Content item not found');
    }

    // Walk up to find the root of the version chain (handles arbitrary depth)
    let rootId = item.id;
    let currentParentId = item.parentId;
    const maxDepth = 50; // Safety limit to prevent infinite loops
    let depth = 0;
    while (currentParentId && depth < maxDepth) {
      rootId = currentParentId;
      const parent = await ctx.db.contentItem.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
      currentParentId = parent?.parentId ?? null;
      depth++;
    }

    // Fetch the root item and all children pointing to the root (tenant-scoped)
    const versions = await ctx.db.contentItem.findMany({
      where: {
        OR: [
          { id: rootId },
          { parentId: rootId },
        ],
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: {
        id: true,
        version: true,
        status: true,
        title: true,
        qualityScore: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { version: 'asc' },
      take: VERSIONS_LIST_LIMIT,
    });

    const converted = versions.map(v => ({
      ...v,
      qualityScore: v.qualityScore != null ? Number(v.qualityScore) : null,
    }));
    return success({ versions: converted, total: converted.length });
  } catch (err) {
    logger.error('GET /api/v1/content/[id]/versions error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch content versions', 500);
  }
}
