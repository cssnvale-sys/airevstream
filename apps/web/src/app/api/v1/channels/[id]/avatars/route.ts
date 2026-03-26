import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const AssignAvatarSchema = z.object({
  avatarId: z.string().uuid(),
  isPrimary: z.boolean().optional().default(false),
  role: z.string().max(100).optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/channels/[id]/avatars
 * List avatars assigned to a channel
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    const channelAvatars = await ctx.db.channelAvatar.findMany({
      where: { channelId: id },
      include: {
        avatar: true,
      },
      orderBy: { isPrimary: 'desc' },
    });

    const data = channelAvatars.map((ca) => ({
      ...ca.avatar,
      isPrimary: ca.isPrimary,
      role: ca.role,
    }));

    return success(data);
  } catch (err) {
    console.error('GET avatars failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list channel avatars', 500);
  }
}

/**
 * POST /api/v1/channels/[id]/avatars
 * Assign an avatar to a channel
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`channels-avatars:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    const body = await req.json();
    const parsed = AssignAvatarSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
    }
    const { avatarId, isPrimary, role } = parsed.data;

    // Verify avatar exists
    const avatar = await ctx.db.avatar.findUnique({ where: { id: avatarId } });
    if (!avatar) return notFound('Avatar not found');

    // Check if already assigned
    const existing = await ctx.db.channelAvatar.findUnique({
      where: { channelId_avatarId: { channelId: id, avatarId } },
    });
    if (existing) {
      return error('CONFLICT', 'Avatar is already assigned to this channel', 409);
    }

    // If setting as primary, unset other primaries and create atomically
    if (isPrimary) {
      const [, channelAvatarResult] = await ctx.db.$transaction([
        ctx.db.channelAvatar.updateMany({
          where: { channelId: id, isPrimary: true },
          data: { isPrimary: false },
        }),
        ctx.db.channelAvatar.create({
          data: {
            channelId: id,
            avatarId,
            isPrimary: true,
            role: role ?? null,
          },
          include: {
            avatar: true,
          },
        }),
      ]);

      return success({
        ...channelAvatarResult.avatar,
        isPrimary: channelAvatarResult.isPrimary,
        role: channelAvatarResult.role,
      });
    }

    const channelAvatar = await ctx.db.channelAvatar.create({
      data: {
        channelId: id,
        avatarId,
        isPrimary: false,
        role: role ?? null,
      },
      include: {
        avatar: true,
      },
    });

    return success({
      ...channelAvatar.avatar,
      isPrimary: channelAvatar.isPrimary,
      role: channelAvatar.role,
    });
  } catch (err) {
    console.error('POST avatars failed:', err);
    return error('INTERNAL_ERROR', 'Failed to assign avatar to channel', 500);
  }
}

/**
 * DELETE /api/v1/channels/[id]/avatars?avatarId=xxx
 * Unassign an avatar from a channel
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`channels-avatars:DELETE:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const avatarId = req.nextUrl.searchParams.get('avatarId');
    if (!avatarId || !isUUID(avatarId)) {
      return validationError('avatarId query parameter is required and must be a valid UUID');
    }

    // Verify channel belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    // Verify the assignment exists
    const existing = await ctx.db.channelAvatar.findUnique({
      where: { channelId_avatarId: { channelId: id, avatarId } },
    });
    if (!existing) {
      return notFound('Avatar is not assigned to this channel');
    }

    await ctx.db.channelAvatar.delete({
      where: { channelId_avatarId: { channelId: id, avatarId } },
    });

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE avatars failed:', err);
    return error('INTERNAL_ERROR', 'Failed to unassign avatar from channel', 500);
  }
}
