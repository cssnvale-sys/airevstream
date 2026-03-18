import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, parseQuery, paginated } from '@/lib/api-server';

/**
 * GET /api/v1/channels/families
 * List channel families (groups of language-variant channels sharing the same familyId)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { page, limit, skip } = parseQuery(req);

  try {
    // Get all channels that have a familyId, grouped by familyId
    const channelsWithFamily = await ctx.db.channel.findMany({
      where: { familyId: { not: null } },
      orderBy: [{ familyId: 'asc' }, { isPrimary: 'desc' }, { name: 'asc' }],
      include: {
        socialAccount: {
          select: { platform: true, username: true },
        },
        _count: { select: { contentItems: true } },
      },
    });

    // Group by familyId
    const familyMap = new Map<string, typeof channelsWithFamily>();
    for (const ch of channelsWithFamily) {
      const fid = ch.familyId!;
      if (!familyMap.has(fid)) familyMap.set(fid, []);
      familyMap.get(fid)!.push(ch);
    }

    const families = Array.from(familyMap.entries()).map(([familyId, channels]) => {
      const primary = channels.find((c) => c.isPrimary) ?? channels[0];
      return {
        familyId,
        name: primary.name,
        primaryLanguage: primary.primaryLanguage,
        languages: [...new Set(channels.map((c) => c.primaryLanguage))],
        channelCount: channels.length,
        channels: channels.map(({ _count, ...ch }) => ({
          ...ch,
          contentItemsCount: _count.contentItems,
        })),
      };
    });

    const total = families.length;
    const paged = families.slice(skip, skip + limit);

    return paginated(paged, total, page, limit);
  } catch (err) {
    return error('INTERNAL_ERROR', 'Failed to list channel families', 500);
  }
}

/**
 * POST /api/v1/channels/families
 * Create a new channel family by assigning a shared familyId to multiple channels
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const { channelIds } = body;

    if (!Array.isArray(channelIds) || channelIds.length < 2) {
      return error('VALIDATION_ERROR', 'channelIds must be an array with at least 2 channel IDs', 400);
    }

    // Verify all channels exist
    const channels = await ctx.db.channel.findMany({
      where: { id: { in: channelIds } },
    });

    if (channels.length !== channelIds.length) {
      return error('NOT_FOUND', 'One or more channels not found', 404);
    }

    // Generate a new family UUID
    const familyId = crypto.randomUUID();

    // Make the first channel the primary
    await ctx.db.$transaction([
      ctx.db.channel.updateMany({
        where: { id: { in: channelIds } },
        data: { familyId },
      }),
      ctx.db.channel.update({
        where: { id: channelIds[0] },
        data: { isPrimary: true },
      }),
    ]);

    const updated = await ctx.db.channel.findMany({
      where: { familyId },
      include: {
        socialAccount: { select: { platform: true, username: true } },
      },
    });

    return success({ familyId, channels: updated });
  } catch (err) {
    return error('INTERNAL_ERROR', 'Failed to create channel family', 500);
  }
}
