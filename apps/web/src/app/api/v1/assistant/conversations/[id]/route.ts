import { authenticate, success, error, notFound, isUUID, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/assistant/conversations/[id]
 * Get conversation with all messages.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const conversation = await ctx.db.conversation.findFirst({
      where: { id, tenantId: ctx.tenantId! },
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
    logger.apiError('METHOD', 'PATH', err as Error, { userId: ctx?.userId });
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
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`assistant-conversations:DELETE:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.conversation.findFirst({ where: { id, tenantId: ctx.tenantId! } });
    if (!existing) return notFound('Conversation not found');

    await ctx.db.conversation.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    logger.apiError('METHOD', 'PATH', err as Error, { userId: ctx?.userId });
    return error('INTERNAL_ERROR', 'Failed to delete conversation', 500);
  }
}
