import { authenticate, success, error, notFound } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/channels/[id]/cinema-bible
 * Get the latest cinema bible for a channel
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findUnique({ where: { id } });
    if (!channel) return notFound('Channel not found');

    const cinemaBible = await ctx.db.cinemaBible.findFirst({
      where: { channelId: id },
      orderBy: { version: 'desc' },
    });

    if (!cinemaBible) return notFound('No cinema bible found for this channel');

    return success(cinemaBible);
  } catch (err) {
    console.error('GET cinema-bible failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch cinema bible', 500);
  }
}

/**
 * PUT /api/v1/channels/[id]/cinema-bible
 * Update or create a cinema bible for a channel
 * Creates a new version if one already exists
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    // Verify channel exists
    const channel = await ctx.db.channel.findUnique({ where: { id } });
    if (!channel) return notFound('Channel not found');

    const body = await req.json();
    const { lookBible, characterBible, environmentBible, promptBible, shotspecTemplate } = body;

    // Find latest version for this channel
    const latestBible = await ctx.db.cinemaBible.findFirst({
      where: { channelId: id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });

    let cinemaBible;

    if (latestBible) {
      // Update existing latest bible
      const data: Record<string, unknown> = {};
      if (lookBible !== undefined) data.lookBible = lookBible;
      if (characterBible !== undefined) data.characterBible = characterBible;
      if (environmentBible !== undefined) data.environmentBible = environmentBible;
      if (promptBible !== undefined) data.promptBible = promptBible;
      if (shotspecTemplate !== undefined) data.shotspecTemplate = shotspecTemplate;

      cinemaBible = await ctx.db.cinemaBible.update({
        where: { id: latestBible.id },
        data,
      });
    } else {
      // Create first cinema bible for this channel
      cinemaBible = await ctx.db.cinemaBible.create({
        data: {
          channelId: id,
          version: 1,
          lookBible: lookBible ?? {},
          characterBible: characterBible ?? {},
          environmentBible: environmentBible ?? {},
          promptBible: promptBible ?? {},
          shotspecTemplate: shotspecTemplate ?? {},
        },
      });
    }

    return success(cinemaBible);
  } catch (err) {
    console.error('PUT cinema-bible failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update cinema bible', 500);
  }
}
