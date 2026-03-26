import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, validationError, isUUID } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/channels/[id]/assets
 * Aggregated channel assets: avatars, scenery, and branding.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify channel belongs to tenant via chain
    const channel = await ctx.db.channel.findFirst({
      where: {
        id,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
    });
    if (!channel) return notFound('Channel not found');

    // Fetch all asset types in parallel
    const [channelAvatars, channelScenery, branding] = await Promise.all([
      ctx.db.channelAvatar.findMany({
        where: { channelId: id },
        include: { avatar: true },
      }),
      ctx.db.channelScenery.findMany({
        where: { channelId: id },
        include: { scenery: true },
      }),
      ctx.db.brandingPackage.findFirst({
        where: { channelId: id },
      }),
    ]);

    const avatars = channelAvatars.map((ca) => ({
      ...ca.avatar,
      isPrimary: ca.isPrimary,
      role: ca.role,
    }));

    const scenery = channelScenery.map((cs) => cs.scenery);

    return success({ avatars, scenery, branding });
  } catch (err) {
    console.error('GET /api/v1/channels/[id]/assets error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch channel assets', 500);
  }
}
