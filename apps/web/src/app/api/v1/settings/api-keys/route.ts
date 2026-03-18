import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';
import { sha256 } from '@airevstream/crypto';

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.tenantId) {
    return error('BAD_REQUEST', 'User must belong to a tenant to manage API keys', 400);
  }

  const keys = await ctx.db.apiKey.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimitRpm: true,
      lastUsedAt: true,
      expiresAt: true,
      status: true,
      createdAt: true,
    },
  });

  return success(keys);
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can create API keys');
  }

  if (!ctx.tenantId) {
    return error('BAD_REQUEST', 'User must belong to a tenant to create API keys', 400);
  }

  try {
    const body = await req.json();
    if (!body.name) return validationError('name is required');

    const rawKey = `ars_${randomBytes(32).toString('hex')}`;
    const keyHash = sha256(rawKey);
    const keyPrefix = rawKey.slice(0, 8) + '...';

    const apiKey = await ctx.db.apiKey.create({
      data: {
        tenantId: ctx.tenantId,
        name: body.name,
        keyHash,
        keyPrefix,
        scopes: body.scopes ?? ['read'],
        rateLimitRpm: body.rateLimitRpm ?? 60,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitRpm: true,
        expiresAt: true,
        status: true,
        createdAt: true,
      },
    });

    // Return the full key ONLY on creation — it cannot be retrieved again
    return success({ ...apiKey, key: rawKey });
  } catch (err: any) {
    console.error('POST /api/v1/settings/api-keys error:', err);
    return error('INTERNAL_ERROR', 'Failed to create API key', 500);
  }
}
