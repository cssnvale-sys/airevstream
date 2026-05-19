import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, paginated, parseQuery } from '@/lib/api-server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/assets
 * List asset registry entries with optional filters.
 * Asset registry is scoped indirectly via content/shot/avatar relations.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { page, limit, skip, sort, order, params } = parseQuery(req);

    const type = params.get('type') ?? undefined;
    const contentId = params.get('contentId') ?? undefined;
    const shotId = params.get('shotId') ?? undefined;
    const avatarId = params.get('avatarId') ?? undefined;

    // Tenant scoping: get tenant's channel IDs for filtering via content relation
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map((c) => c.id);

    // Get tenant's content IDs for scoping assets without a direct tenantId
    const tenantContentIds = (await ctx.db.contentItem.findMany({
      where: { channelId: { in: tenantChannelIds } },
      select: { id: true },
    })).map((c) => c.id);

    const where: Record<string, unknown> = {
      // Scope to tenant: assets must belong to tenant's content, avatars, or shots
      OR: [
        { contentId: { in: tenantContentIds } },
        { avatar: { tenantId: ctx.tenantId } },
        { shot: { storyboard: { contentId: { in: tenantContentIds } } } },
      ],
    };

    if (type) {
      where.type = type;
    }
    if (contentId) {
      where.contentId = contentId;
    }
    if (shotId) {
      where.shotId = shotId;
    }
    if (avatarId) {
      where.avatarId = avatarId;
    }

    const allowedSortFields = ['createdAt', 'type', 'fileSize'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [assets, total] = await Promise.all([
      ctx.db.assetRegistryEntry.findMany({
        where,
        include: {
          avatar: { select: { id: true, name: true } },
          content: { select: { id: true, title: true } },
          shot: { select: { id: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.assetRegistryEntry.count({ where }),
    ]);

    return paginated(assets, total, page, limit);
  } catch (err) {
    logger.error('GET /api/v1/assets error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch assets', 500);
  }
}
