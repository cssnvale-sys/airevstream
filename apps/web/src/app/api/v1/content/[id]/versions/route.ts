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

    // Walk up to find the root of the version chain
    let rootId = item.parentId ?? item.id;
    if (item.parentId) {
      const parent = await ctx.db.contentItem.findUnique({
        where: { id: item.parentId },
        select: { id: true, parentId: true },
      });
      // If the parent itself has a parent, walk up further
      if (parent?.parentId) {
        rootId = parent.parentId;
      }
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

    return success(versions);
  } catch (err) {
    console.error('GET /api/v1/content/[id]/versions error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
