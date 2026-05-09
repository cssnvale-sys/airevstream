import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden, formatZodErrors , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const CreateVariantSchema = z.object({
  title: z.string().max(500).optional(),
  prompt: z.string().max(50000).optional(),
  modifications: z.record(z.unknown()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/content/[id]/variants — List all variants of a content item
export async function GET(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (!ctx.tenantId) return forbidden('No tenant context');

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content/variants:get:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    // Find the root content item (check if this item IS the root, or has a parentId)
    const contentItem = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true, parentId: true, version: true },
    });

    if (!contentItem) {
      return notFound('Content item not found');
    }

    const rootId = contentItem.parentId ?? contentItem.id;

    // Get the root item and all its variants (tenant-scoped)
    const variants = await ctx.db.contentItem.findMany({
      where: {
        OR: [{ id: rootId }, { parentId: rootId }],
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
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
      take: 100,
    });

    return success({
      rootId,
      totalVariants: variants.length,
      variants: variants.map(v => ({
        id: v.id,
        title: v.title,
        version: v.version,
        status: v.status,
        qualityScore: v.qualityScore != null ? Number(v.qualityScore) : null,
        contentType: v.contentType,
        isRoot: v.parentId === null,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error('GET /api/v1/content/[id]/variants error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch content variants', 500);
  }
}

// POST /api/v1/content/[id]/variants — Create a new variant (clone + modify)
export async function POST(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot perform this action');
    }

    if (!ctx.tenantId) return forbidden('No tenant context');

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content/variants:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const rawBody = await req.json();
    const parsed = CreateVariantSchema.safeParse(rawBody);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }
    const body = parsed.data;

    // Load the source content item
    const source = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
    });

    if (!source) {
      return notFound('Source content not found');
    }

    const rootId = source.parentId ?? source.id;

    // Determine the next version number (tenant-scoped)
    const maxVersion = await ctx.db.contentItem.aggregate({
      where: {
        OR: [{ id: rootId }, { parentId: rootId }],
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
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
    logger.error('POST /api/v1/content/[id]/variants error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to create content variant', 500);
  }
}
