import { authenticate, success, error, notFound, isUUID, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/assistant/conversations/[id]
 * Get conversation with all messages.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const conversation = await ctx.db.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            tokensUsed: true,
            actionProposed: true,
            createdAt: true,
          },
        },
        actions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            actionType: true,
            tier: true,
            status: true,
            parameters: true,
            result: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) return notFound('Conversation not found');

    return success(conversation);
  } catch (err) {
    console.error('GET /api/v1/assistant/conversations/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch conversation', 500);
  }
}

/**
 * DELETE /api/v1/assistant/conversations/[id]
 * Delete a conversation and all its messages.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.conversation.findUnique({ where: { id } });
    if (!existing) return notFound('Conversation not found');

    await ctx.db.conversation.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/assistant/conversations/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to delete conversation', 500);
  }
}
