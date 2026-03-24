import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, paginated, parseQuery } from '@/lib/api-server';

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { page, limit, skip, sort, order, params } = parseQuery(req);
    const statusParam = params.get('status') ?? undefined;
    const contentTypeParam = params.get('contentType') ?? undefined;

    const validStatuses = ['draft', 'generating', 'generated', 'pending_approval', 'approved', 'scheduled', 'posted', 'archived', 'failed'];
    const validContentTypes = ['video_short', 'video_long', 'image', 'text', 'voice', 'thumbnail', 'article', 'post'];
    const where: Record<string, unknown> = {
      status: statusParam && validStatuses.includes(statusParam) ? statusParam : 'pending_approval',
      // Tenant scoping: only show content from this tenant's channels
      channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
    };

    if (contentTypeParam && validContentTypes.includes(contentTypeParam)) {
      where.contentType = contentTypeParam;
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'title', 'contentType'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [rawItems, total] = await Promise.all([
      ctx.db.contentItem.findMany({
        where,
        include: {
          channel: {
            select: { id: true, name: true, primaryLanguage: true },
          },
          aiService: {
            select: { id: true, name: true },
          },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.contentItem.count({ where }),
    ]);

    // Convert Prisma Decimal fields to numbers for JSON serialization
    const items = rawItems.map((item) => ({
      ...item,
      qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
    }));

    return paginated(items, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/approvals error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
