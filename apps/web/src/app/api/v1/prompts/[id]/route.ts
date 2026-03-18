import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

const updatePromptSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(50).optional(),
  platform: z.string().max(20).optional().nullable(),
  contentType: z.string().max(30).optional().nullable(),
  template: z.string().min(1).optional(),
  negativePrompt: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  incrementUsage: z.boolean().optional(),
});

/**
 * GET /api/v1/prompts/[id]
 * Get a single prompt template by ID.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const template = await ctx.db.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return notFound('Prompt template not found');
    }

    return success(template);
  } catch (err) {
    console.error('GET /api/v1/prompts/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch prompt template', 500);
  }
}

/**
 * PATCH /api/v1/prompts/[id]
 * Update a prompt template.
 * If `incrementUsage: true` is in the body, also increment usageCount.
 *
 * Body: { name?, category?, platform?, contentType?, template?, negativePrompt?, tags?, metadata?, incrementUsage? }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const existing = await ctx.db.promptTemplate.findUnique({ where: { id } });
    if (!existing) {
      return notFound('Prompt template not found');
    }

    const body = await req.json();
    const parsed = updatePromptSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { incrementUsage, ...fields } = parsed.data;

    const data: Record<string, unknown> = {};

    if (fields.name !== undefined) data.name = fields.name;
    if (fields.category !== undefined) data.category = fields.category;
    if (fields.platform !== undefined) data.platform = fields.platform;
    if (fields.contentType !== undefined) data.contentType = fields.contentType;
    if (fields.template !== undefined) data.template = fields.template;
    if (fields.negativePrompt !== undefined) data.negativePrompt = fields.negativePrompt;
    if (fields.tags !== undefined) data.tags = fields.tags;
    if (fields.metadata !== undefined) data.metadata = fields.metadata;

    if (incrementUsage) {
      data.usageCount = { increment: 1 };
    }

    const updated = await ctx.db.promptTemplate.update({
      where: { id },
      data,
    });

    return success(updated);
  } catch (err) {
    console.error('PATCH /api/v1/prompts/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to update prompt template', 500);
  }
}

/**
 * DELETE /api/v1/prompts/[id]
 * Delete a prompt template.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const existing = await ctx.db.promptTemplate.findUnique({ where: { id } });
    if (!existing) {
      return notFound('Prompt template not found');
    }

    await ctx.db.promptTemplate.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/prompts/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to delete prompt template', 500);
  }
}
