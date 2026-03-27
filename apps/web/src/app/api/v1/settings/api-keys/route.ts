import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';
import { sha256 } from '@airevstream/crypto';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).optional(),
  rateLimitRpm: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const ip = getClientIp(req);
    const rl = checkRateLimit(`settings-apikeys:GET:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    if (!ctx.tenantId) {
      return error('BAD_REQUEST', 'User must belong to a tenant to manage API keys', 400);
    }

    const keys = await ctx.db.apiKey.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
  } catch (err) {
    console.error('GET /api/v1/settings/api-keys failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch API keys', 500);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`api-key-create:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can create API keys');
  }

  if (!ctx.tenantId) {
    return error('BAD_REQUEST', 'User must belong to a tenant to create API keys', 400);
  }

  try {
    const body = await req.json();
    const parsed = CreateApiKeySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const rawKey = `ars_${randomBytes(32).toString('hex')}`;
    const keyHash = sha256(rawKey);
    const keyPrefix = rawKey.slice(0, 8) + '...';

    const apiKey = await ctx.db.apiKey.create({
      data: {
        tenantId: ctx.tenantId,
        name: parsed.data.name,
        keyHash,
        keyPrefix,
        scopes: parsed.data.scopes ?? ['read'],
        rateLimitRpm: parsed.data.rateLimitRpm ?? 60,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
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
  } catch (err) {
    console.error('POST /api/v1/settings/api-keys error:', err);
    return error('INTERNAL_ERROR', 'Failed to create API key', 500);
  }
}
