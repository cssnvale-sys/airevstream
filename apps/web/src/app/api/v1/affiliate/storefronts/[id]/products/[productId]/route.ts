import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string; productId: string }> };

const updateProductSchema = z.object({
  displayOrder: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  customTitle: z.string().max(255).nullish(),
  customDescription: z.string().nullish(),
  status: z.enum(['active', 'hidden']).optional(),
}).strict();

/**
 * PATCH /api/v1/affiliate/storefronts/[id]/products/[productId]
 * Update a product's display settings within a storefront.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id, productId } = await params;

  try {
    // Verify storefront exists
    const storefront = await ctx.db.storefront.findUnique({ where: { id } });
    if (!storefront) return notFound('Storefront not found');

    // Verify storefront product exists
    const existing = await ctx.db.storefrontProduct.findFirst({
      where: { id: productId, storefrontId: id },
    });
    if (!existing) return notFound('Storefront product not found');

    const body = await req.json();
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => e.message).join('; ');
      return validationError(messages);
    }

    const updated = await ctx.db.storefrontProduct.update({
      where: { id: productId },
      data: parsed.data,
    });

    return success(updated);
  } catch (err) {
    console.error('PATCH /api/v1/affiliate/storefronts/[id]/products/[productId] error:', err);
    return error('INTERNAL_ERROR', 'Failed to update storefront product', 500);
  }
}

/**
 * DELETE /api/v1/affiliate/storefronts/[id]/products/[productId]
 * Remove a product from a storefront.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id, productId } = await params;

  try {
    // Verify storefront exists
    const storefront = await ctx.db.storefront.findUnique({ where: { id } });
    if (!storefront) return notFound('Storefront not found');

    // Verify storefront product exists
    const existing = await ctx.db.storefrontProduct.findFirst({
      where: { id: productId, storefrontId: id },
    });
    if (!existing) return notFound('Storefront product not found');

    await ctx.db.storefrontProduct.delete({ where: { id: productId } });

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/affiliate/storefronts/[id]/products/[productId] error:', err);
    return error('INTERNAL_ERROR', 'Failed to remove product from storefront', 500);
  }
}
