import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, forbidden } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can revoke API keys');
  }

  const { id } = await params;

  try {
    const existing = await ctx.db.apiKey.findUnique({ where: { id } });
    if (!existing) return notFound('API key not found');

    if (ctx.tenantId && existing.tenantId !== ctx.tenantId) {
      return forbidden('Cannot revoke API keys from another tenant');
    }

    await ctx.db.apiKey.update({
      where: { id },
      data: { status: 'revoked' },
    });

    return success({ id, revoked: true });
  } catch (err) {
    console.error('POST /api/v1/settings/api-keys/[id]/revoke error:', err);
    return error('INTERNAL_ERROR', 'Failed to revoke API key', 500);
  }
}
