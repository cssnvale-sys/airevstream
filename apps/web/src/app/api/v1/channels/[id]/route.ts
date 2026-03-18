import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/channels/[id]
 * Get channel detail with full identity and relations
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const channel = await ctx.db.channel.findUnique({
      where: { id },
      include: {
        socialAccount: {
          include: {
            emailAccount: {
              select: {
                id: true,
                email: true,
                tier: true,
                status: true,
              },
            },
          },
        },
        channelAvatars: {
          include: {
            avatar: true,
          },
        },
        brandingPackages: true,
        cinemaBibles: {
          orderBy: { version: 'desc' },
        },
        affiliatePool: {
          include: {
            affiliateProduct: true,
          },
        },
        _count: {
          select: { contentItems: true },
        },
      },
    });

    if (!channel) return notFound('Channel not found');

    // Strip encrypted credentials from social account
    const { credentialsEnc, ...safeSocial } = channel.socialAccount;
    const { _count, ...rest } = channel;

    return success({
      ...rest,
      socialAccount: safeSocial,
      contentItemsCount: _count.contentItems,
    });
  } catch (err) {
    console.error('GET /api/v1/channels/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch channel', 500);
  }
}

/**
 * PUT /api/v1/channels/[id]
 * Update channel identity fields
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const existing = await ctx.db.channel.findUnique({ where: { id } });
    if (!existing) return notFound('Channel not found');

    const body = await req.json();
    const {
      name,
      niches,
      primaryLanguage,
      tone,
      personality,
      targetAudience,
      postingCadence,
      status,
      familyId,
    } = body;

    if (niches !== undefined && !Array.isArray(niches)) {
      return validationError('niches must be an array of strings');
    }

    const validStatuses = ['active', 'paused', 'disabled', 'archived'];
    if (status && !validStatuses.includes(status)) {
      return validationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (niches !== undefined) data.niches = niches;
    if (primaryLanguage !== undefined) data.primaryLanguage = primaryLanguage;
    if (tone !== undefined) data.tone = tone;
    if (personality !== undefined) data.personality = personality;
    if (targetAudience !== undefined) data.targetAudience = targetAudience;
    if (postingCadence !== undefined) data.postingCadence = postingCadence;
    if (status !== undefined) data.status = status;
    if (familyId !== undefined) data.familyId = familyId;

    const updated = await ctx.db.channel.update({
      where: { id },
      data,
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            username: true,
          },
        },
      },
    });

    return success(updated);
  } catch (err) {
    console.error('PUT /api/v1/channels/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update channel', 500);
  }
}

/**
 * DELETE /api/v1/channels/[id]
 * Delete a channel and cascade-clean related records
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const channel = await ctx.db.channel.findUnique({
      where: { id },
      select: {
        id: true,
        socialAccount: {
          select: {
            emailAccount: { select: { tenantId: true } },
          },
        },
      },
    });

    if (!channel) return notFound('Channel not found');

    // Verify tenant ownership
    if (ctx.tenantId && channel.socialAccount.emailAccount.tenantId !== ctx.tenantId) {
      return notFound('Channel not found');
    }

    // Cascade delete: scheduled posts, affiliate pool entries, channel avatars,
    // branding packages, cinema bibles, then the channel itself
    await ctx.db.$transaction([
      ctx.db.scheduledPost.deleteMany({ where: { channelId: id } }),
      ctx.db.channelAffiliatePool.deleteMany({ where: { channelId: id } }),
      ctx.db.channelAvatar.deleteMany({ where: { channelId: id } }),
      ctx.db.brandingPackage.deleteMany({ where: { channelId: id } }),
      ctx.db.cinemaBible.deleteMany({ where: { channelId: id } }),
      ctx.db.channel.delete({ where: { id } }),
    ]);

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/channels/[id] failed:', err);
    return error('INTERNAL_ERROR', 'Failed to delete channel', 500);
  }
}
