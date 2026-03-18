import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID } from '@/lib/api-server';

const CreateVariantSchema = z.object({
  title: z.string().max(500).optional(),
  prompt: z.string().max(50000).optional(),
  modifications: z.record(z.unknown()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/content/[id]/variants — List all variants of a content item
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    // Find the root content item (check if this item IS the root, or has a parentId)
    const contentItem = await ctx.db.contentItem.findFirst({
      where: {
        id,
        ...(ctx.tenantId ? { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } : {}),
      },
      select: { id: true, parentId: true, version: true },
    });

    if (!contentItem) {
      return notFound('Content item not found');
    }

    const rootId = contentItem.parentId ?? contentItem.id;

    // Get the root item and all its variants
    const variants = await ctx.db.contentItem.findMany({
      where: {
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      select: {
        id: true,
        title: true,
        version: true,
        status: true,
        qualityScore: true,
        contentType: true,
        createdAt: true,
        parentId: true,
        platformMetadata: true,
      },
      orderBy: { version: 'asc' },
    });

    return success({
      rootId,
      totalVariants: variants.length,
      variants: variants.map(v => ({
        id: v.id,
        title: v.title,
        version: v.version,
        status: v.status,
        qualityScore: v.qualityScore ? Number(v.qualityScore) : null,
        contentType: v.contentType,
        isRoot: v.parentId === null,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('GET /api/v1/content/[id]/variants error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

// POST /api/v1/content/[id]/variants — Create a new variant (clone + modify)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const rawBody = await req.json();
    const parsed = CreateVariantSchema.safeParse(rawBody);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const body = parsed.data;

    // Load the source content item
    const source = await ctx.db.contentItem.findFirst({
      where: {
        id,
        ...(ctx.tenantId ? { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } : {}),
      },
    });

    if (!source) {
      return notFound('Source content not found');
    }

    const rootId = source.parentId ?? source.id;

    // Determine the next version number
    const maxVersion = await ctx.db.contentItem.aggregate({
      where: {
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 1) + 1;

    // Create the variant
    const variant = await ctx.db.contentItem.create({
      data: {
        title: body.title ?? `${source.title} (v${nextVersion})`,
        prompt: body.prompt ?? source.prompt,
        contentType: source.contentType,
        status: 'draft',
        version: nextVersion,
        parentId: rootId,
        channelId: source.channelId,
        aiServiceId: source.aiServiceId,
        generationParams: (source.generationParams as object) ?? undefined,
        platformMetadata: body.modifications
          ? {
              ...((source.platformMetadata as Record<string, unknown>) ?? {}),
              ...body.modifications,
            }
          : (source.platformMetadata as object) ?? undefined,
        beatTags: (source.beatTags as object) ?? undefined,
      },
    });

    return success(
      {
        id: variant.id,
        title: variant.title,
        version: variant.version,
        parentId: variant.parentId,
        status: variant.status,
      },
      { created: true },
    );
  } catch (err) {
    console.error('POST /api/v1/content/[id]/variants error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
