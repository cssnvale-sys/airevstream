import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/channels/[id]/avatars
 * List avatars assigned to a channel
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        ...(ctx.tenantId ? { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } : {}),
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

  const { id } = await params;

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        ...(ctx.tenantId ? { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } : {}),
      },
    });
    if (!channel) return notFound('Channel not found');

    const body = await req.json();
    const { avatarId, isPrimary, role } = body;

    if (!avatarId) {
      return validationError('avatarId is required');
    }

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
