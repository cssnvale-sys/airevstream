import { authenticate, success, error, notFound, paginated, parseQuery, validationError, isUUID, forbidden, formatZodErrors } from '@/lib/api-server';
import { encrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const CreateSocialSchema = z.object({
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'facebook']),
  platformUserId: z.string().max(255).optional().nullable(),
  username: z.string().max(255).optional().nullable(),
  credentials: z.union([z.string(), z.record(z.unknown())]).optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/accounts/[id]/socials
 * List social accounts for an email account
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');
  const { page, limit, skip, sort, order, params: queryParams } = parseQuery(req);
  const platform = queryParams.get('platform') ?? undefined;
  const status = queryParams.get('status') ?? undefined;

  try {
    // Verify email account exists and belongs to tenant
    const emailAccount = await ctx.db.emailAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!emailAccount) return notFound('Email account not found');

    const where: Record<string, unknown> = { emailAccountId: id };
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const allowedSorts = ['platform', 'username', 'createdAt', 'status', 'healthScore'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const [socials, total] = await Promise.all([
      ctx.db.socialAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: order },
        include: {
          _count: { select: { channels: true } },
        },
      }),
      ctx.db.socialAccount.count({ where }),
    ]);

    const data = socials.map(({ credentialsEnc, _count, ...sa }) => ({
      ...sa,
      channelsCount: _count.channels,
    }));

    return paginated(data, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/accounts/[id]/socials failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list social accounts', 500);
  }
}

/**
 * POST /api/v1/accounts/[id]/socials
 * Create a social account linked to an email account
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`accounts/[id]/socials:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify email account exists and belongs to tenant
    const emailAccount = await ctx.db.emailAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!emailAccount) return notFound('Email account not found');

    const body = await req.json();
    const parsed = CreateSocialSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { platform, platformUserId, username, credentials } = parsed.data;

    // Check for duplicate platform account under this email
    const existing = await ctx.db.socialAccount.findUnique({
      where: { emailAccountId_platform: { emailAccountId: id, platform } },
    });
    if (existing) {
      return error('CONFLICT', `A ${platform} account already exists for this email`, 409);
    }

    let credentialsEnc: string | null = null;
    if (credentials) {
      const config = getConfig();
      if (!config.ENCRYPTION_KEY) {
        return error('CONFIG_ERROR', 'Encryption key not configured', 500);
      }
      credentialsEnc = encrypt(
        typeof credentials === 'string' ? credentials : JSON.stringify(credentials),
        config.ENCRYPTION_KEY,
      );
    }

    const social = await ctx.db.socialAccount.create({
      data: {
        emailAccountId: id,
        platform,
        platformUserId: platformUserId ?? null,
        username: username ?? null,
        credentialsEnc,
      },
    });

    const { credentialsEnc: _, ...safe } = social;
    return success(safe);
  } catch (err) {
    console.error('POST /api/v1/accounts/[id]/socials failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create social account', 500);
  }
}
