import { NextRequest } from 'next/server';
import { authenticate, success, error, validationError, isUUID, type ApiContext } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

function tenantFilter(tenantId: string) {
  return { channel: { socialAccount: { emailAccount: { tenantId } } } };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    const avatars = await ctx.db.seriesAvatar.findMany({
      where: { seriesId: id },
      include: {
        avatar: { select: { id: true, name: true, images: true, description: true } },
      },
    });

    return success(avatars);
  } catch (err) {
    console.error('GET /api/v1/series/[id]/avatars failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch series avatars', 500);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot assign avatars', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`series-avatar:create:${(ctx as ApiContext).userId}:${ip}`, { maxAttempts: 20, windowMs: 60_000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    const body = await req.json();
    const { avatarId, role, isPrimary } = body;

    if (!avatarId) return validationError('avatarId is required');
    if (!isUUID(avatarId)) return validationError('Invalid avatarId');

    const seriesAvatar = await ctx.db.seriesAvatar.create({
      data: {
        seriesId: id,
        avatarId,
        role: role ?? null,
        isPrimary: isPrimary ?? false,
      },
      include: {
        avatar: { select: { id: true, name: true, images: true } },
      },
    });

    return success(seriesAvatar);
  } catch (err) {
    console.error('POST /api/v1/series/[id]/avatars failed:', err);
    return error('INTERNAL_ERROR', 'Failed to assign avatar', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if ((ctx as ApiContext).role === 'viewer') return error('FORBIDDEN', 'Viewers cannot remove avatars', 403);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid series ID');

    const series = await ctx.db.series.findFirst({
      where: { id, ...tenantFilter(ctx.tenantId) },
      select: { id: true },
    });
    if (!series) return error('NOT_FOUND', 'Series not found', 404);

    const url = new URL(req.url);
    const avatarId = url.searchParams.get('avatarId');
    if (!avatarId || !isUUID(avatarId)) return validationError('avatarId query parameter is required');

    await ctx.db.seriesAvatar.delete({
      where: { seriesId_avatarId: { seriesId: id, avatarId } },
    });

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/series/[id]/avatars failed:', err);
    return error('INTERNAL_ERROR', 'Failed to remove avatar', 500);
  }
}
