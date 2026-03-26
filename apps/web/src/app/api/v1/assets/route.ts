import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, paginated, parseQuery } from '@/lib/api-server';

/**
 * GET /api/v1/assets
 * List asset registry entries with optional filters.
 * Asset registry is scoped indirectly via content/shot/avatar relations.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, sort, order, params } = parseQuery(req);

    const type = params.get('type') ?? undefined;
    const contentId = params.get('contentId') ?? undefined;
    const shotId = params.get('shotId') ?? undefined;
    const avatarId = params.get('avatarId') ?? undefined;

    const where: Record<string, unknown> = {};

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
        where: where as any,
        include: {
          avatar: { select: { id: true, name: true } },
          content: { select: { id: true, title: true } },
          shot: { select: { id: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.assetRegistryEntry.count({ where: where as any }),
    ]);

    return paginated(assets, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/assets error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch assets', 500);
  }
}
