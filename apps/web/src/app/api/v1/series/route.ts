import { NextRequest } from 'next/server';
import { authenticate, success, paginated, error, validationError, parseQuery, isUUID, type ApiContext } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Tenant scoping for Series: channel → socialAccount → emailAccount → tenantId
function tenantFilter(tenantId: string) {
  return { channel: { socialAccount: { emailAccount: { tenantId } } } };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { page, limit, skip, order, search, params } = parseQuery(req);
    const channelId = params.get('channelId') ?? undefined;
    const status = params.get('status') ?? undefined;

    const where: Record<string, unknown> = { ...tenantFilter(ctx.tenantId) };
    if (channelId) where.channelId = channelId;
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      ctx.db.series.findMany({
        where,
        include: {
          channel: { select: { id: true, name: true } },
          _count: { select: { episodes: true } },
        },
        orderBy: { createdAt: order as 'asc' | 'desc' },
        skip,
        take: limit,
      }),
      ctx.db.series.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/series failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch series', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot create series', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`series:create:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 20, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const body = await req.json();
    const { channelId, name, description, status: seriesStatus, coverImageUrl, targetAudience, tags, defaultPresetIds, defaultRecipeId, bibleOverrides, postingCadence, youtubePlaylistId, baseSeed } = body;

    if (!channelId || !name) return validationError('channelId and name are required');
    if (!isUUID(channelId)) return validationError('Invalid channelId');

    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: { id: channelId, ...tenantFilter(ctx.tenantId).channel },
    });
    if (!channel) return error('NOT_FOUND', 'Channel not found', 404);

    const series = await ctx.db.series.create({
      data: {
        channelId,
        name,
        description: description ?? null,
        status: seriesStatus ?? 'draft',
        coverImageUrl: coverImageUrl ?? null,
        targetAudience: targetAudience ?? null,
        tags: tags ?? [],
        defaultPresetIds: defaultPresetIds ?? [],
        defaultRecipeId: defaultRecipeId ?? null,
        bibleOverrides: bibleOverrides ?? {},
        postingCadence: postingCadence ?? {},
        youtubePlaylistId: youtubePlaylistId ?? null,
        baseSeed: baseSeed ?? null,
      },
      include: {
        channel: { select: { id: true, name: true } },
      },
    });

    return success(series);
  } catch (err) {
    console.error('POST /api/v1/series failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create series', 500);
  }
}
