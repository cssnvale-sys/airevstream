import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ id: string }> };

const updateEntrySchema = z.object({
  domain: z.enum(['platform_ops', 'civitai', 'remotion', 'huggingface', 'comfyui', 'video_production']).optional(),
  category: z.string().max(100).optional().nullable(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(50000).optional(),
  sourceUrl: z.string().url().optional().nullable(),
  relevanceScore: z.number().min(0).max(10).optional().nullable(),
  isCurrent: z.boolean().optional(),
}).strict();

/**
 * GET /api/v1/knowledge-base/[id]
 * Get a single knowledge base entry by ID.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const entry = await ctx.db.knowledgeBaseEntry.findFirst({
      where: { id, tenantId: ctx.tenantId! },
    });

    if (!entry) {
      return notFound('Knowledge base entry not found');
    }

    return success({
      ...entry,
      relevanceScore: entry.relevanceScore != null ? Number(entry.relevanceScore) : null,
    });
  } catch (err) {
    console.error('GET /api/v1/knowledge-base/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch knowledge base entry', 500);
  }
}

/**
 * PATCH /api/v1/knowledge-base/[id]
 * Update a knowledge base entry.
 *
 * Body: partial { domain, category, title, content, sourceUrl, relevanceScore, isCurrent }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`knowledge-base/[id]:patch:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const existing = await ctx.db.knowledgeBaseEntry.findFirst({
      where: { id, tenantId: ctx.tenantId! },
      select: { id: true },
    });

    if (!existing) {
      return notFound('Knowledge base entry not found');
    }

    const body = await req.json();
    const parsed = updateEntrySchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const data: Record<string, unknown> = {};

    if (parsed.data.domain !== undefined) data.domain = parsed.data.domain;
    if (parsed.data.category !== undefined) data.category = parsed.data.category;
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.content !== undefined) data.content = parsed.data.content;
    if (parsed.data.sourceUrl !== undefined) data.sourceUrl = parsed.data.sourceUrl;
    if (parsed.data.relevanceScore !== undefined) data.relevanceScore = parsed.data.relevanceScore;
    if (parsed.data.isCurrent !== undefined) data.isCurrent = parsed.data.isCurrent;

    if (Object.keys(data).length === 0) {
      return validationError('At least one field must be provided for update');
    }

    const updated = await ctx.db.knowledgeBaseEntry.update({
      where: { id },
      data,
    });

    return success({
      ...updated,
      relevanceScore: updated.relevanceScore != null ? Number(updated.relevanceScore) : null,
    });
  } catch (err) {
    console.error('PATCH /api/v1/knowledge-base/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to update knowledge base entry', 500);
  }
}

/**
 * DELETE /api/v1/knowledge-base/[id]
 * Delete a knowledge base entry.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`knowledge-base/[id]:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const { id } = await params;
    if (!isUUID(id)) return validationError('Invalid ID format');

    const existing = await ctx.db.knowledgeBaseEntry.findFirst({
      where: { id, tenantId: ctx.tenantId! },
      select: { id: true },
    });

    if (!existing) {
      return notFound('Knowledge base entry not found');
    }

    await ctx.db.knowledgeBaseEntry.delete({
      where: { id },
    });

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/knowledge-base/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to delete knowledge base entry', 500);
  }
}
