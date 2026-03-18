import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const item = await ctx.db.contentItem.findUnique({
      where: { id },
      select: { id: true, parentId: true },
    });

    if (!item) {
      return notFound('Content item not found');
    }

    // Walk up to find the root of the version chain (handles arbitrary depth)
    let rootId = item.id;
    let currentParentId = item.parentId;
    const maxDepth = 50; // Safety limit to prevent infinite loops
    let depth = 0;
    while (currentParentId && depth < maxDepth) {
      rootId = currentParentId;
      const parent = await ctx.db.contentItem.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
      currentParentId = parent?.parentId ?? null;
      depth++;
    }

    // Fetch the root item and all children pointing to the root
    const versions = await ctx.db.contentItem.findMany({
      where: {
        OR: [
          { id: rootId },
          { parentId: rootId },
        ],
      },
      select: {
        id: true,
        version: true,
        status: true,
        title: true,
        qualityScore: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { version: 'asc' },
    });

    const converted = versions.map(v => ({
      ...v,
      qualityScore: v.qualityScore != null ? Number(v.qualityScore) : null,
    }));
    return success(converted);
  } catch (err) {
    console.error('GET /api/v1/content/[id]/versions error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
