import { authenticate, success, error, notFound, paginated, parseQuery, validationError } from '@/lib/api-server';
import { encrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/accounts/[id]/socials
 * List social accounts for an email account
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const { page, limit, skip, sort, order, params: queryParams } = parseQuery(req);
  const platform = queryParams.get('platform') ?? undefined;
  const status = queryParams.get('status') ?? undefined;

  try {
    // Verify email account exists
    const emailAccount = await ctx.db.emailAccount.findUnique({ where: { id } });
    if (!emailAccount) return notFound('Email account not found');

    const where: Record<string, unknown> = { emailAccountId: id };
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const [socials, total] = await Promise.all([
      ctx.db.socialAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          _count: { select: { channels: true } },
        },
      }),
      ctx.db.socialAccount.count({ where }),
    ]);

    const data = socials.map(({ credentialsEnc, ...sa }) => ({
      ...sa,
      channelsCount: sa._count.channels,
      _count: undefined,
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

  const { id } = await params;

  try {
    // Verify email account exists
    const emailAccount = await ctx.db.emailAccount.findUnique({ where: { id } });
    if (!emailAccount) return notFound('Email account not found');

    const body = await req.json();
    const { platform, platformUserId, username, credentials } = body;

    if (!platform) {
      return validationError('Platform is required');
    }

    const validPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
    if (!validPlatforms.includes(platform)) {
      return validationError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
    }

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
