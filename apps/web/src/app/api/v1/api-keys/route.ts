import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { authenticate, success, error, paginated, parseQuery, validationError } from '@/lib/api-server';

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).default(['read']),
  rateLimitRpm: z.number().int().min(1).max(10000).default(60),
  expiresAt: z.string().datetime().optional(),
});

/**
 * GET /api/v1/api-keys
 * List API keys for the current user's tenant (show keyPrefix, not full key)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
    if (!user) {
      return error('UNAUTHORIZED', 'User not found', 401);
    }

    if (!user.tenantId) {
      return error('BAD_REQUEST', 'User is not assigned to a tenant', 400);
    }

    const { page, limit, skip, sort, order } = parseQuery(req);

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status') ?? undefined;

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };
    if (statusFilter) where.status = statusFilter;

    const [keys, total] = await Promise.all([
      ctx.db.apiKey.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        select: {
          id: true,
          tenantId: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          rateLimitRpm: true,
          lastUsedAt: true,
          expiresAt: true,
          status: true,
          createdAt: true,
        },
      }),
      ctx.db.apiKey.count({ where }),
    ]);

    return paginated(keys, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/api-keys failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list API keys', 500);
  }
}

/**
 * POST /api/v1/api-keys
 * Create a new API key
 * Returns the full key ONLY in this response (never again)
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
    if (!user) {
      return error('UNAUTHORIZED', 'User not found', 401);
    }

    if (!user.tenantId) {
      return error('BAD_REQUEST', 'User is not assigned to a tenant', 400);
    }

    const body = await req.json();
    const parsed = createApiKeySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { name, scopes, rateLimitRpm, expiresAt } = parsed.data;

    // Generate the API key: ars_ + 32 random hex characters
    const rawKey = `ars_${randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await ctx.db.apiKey.create({
      data: {
        tenantId: user.tenantId,
        name,
        keyHash,
        keyPrefix,
        scopes,
        rateLimitRpm,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitRpm: true,
        expiresAt: true,
        status: true,
        createdAt: true,
      },
    });

    // Return the full key ONLY in this creation response
    return success({
      ...apiKey,
      key: rawKey,
    });
  } catch (err) {
    console.error('POST /api/v1/api-keys failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create API key', 500);
  }
}
