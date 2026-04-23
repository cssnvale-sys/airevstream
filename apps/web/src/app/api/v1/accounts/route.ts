import { authenticate, success, error, paginated, parseQuery, validationError, forbidden, formatZodErrors, type ApiContext } from '@/lib/api-server';
import { encrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';
import { startAccountLifecyclePipeline } from '@airevstream/queue';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const CreateAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
  tier: z.enum(['tier1', 'tier2', 'tier3']).optional(),
  notes: z.string().max(1000).optional().nullable(),
  targetPlatforms: z.array(z.enum(['youtube', 'tiktok', 'instagram', 'facebook'])).optional(),
  avatarId: z.string().uuid().optional(),
  autoSeasoning: z.boolean().optional(),
  autoPosting: z.boolean().optional(),
});

/**
 * GET /api/v1/accounts
 * List email accounts (paginated, filterable by status, tier, search)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { page, limit, skip, sort, order, search, params } = parseQuery(req);
  const status = params.get('status') ?? undefined;
  const tier = params.get('tier') ?? undefined;

  const validStatuses = ['active', 'pending', 'disabled', 'flagged', 'needs_signup'];
  const validTiers = ['tier1', 'tier2', 'tier3'];

  try {
    const where: Record<string, unknown> = {};

    // Tenant scoping: only show accounts belonging to user's tenant
    where.tenantId = ctx.tenantId;

    if (status && validStatuses.includes(status)) where.status = status;
    if (tier && validTiers.includes(tier)) where.tier = tier;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSorts = ['email', 'createdAt', 'updatedAt', 'status', 'tier'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const [accounts, total] = await Promise.all([
      ctx.db.emailAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: order },
        include: {
          _count: { select: { socialAccounts: true } },
          socialAccounts: {
            select: {
              id: true,
              platform: true,
              username: true,
              status: true,
              healthScore: true,
            },
          },
        },
      }),
      ctx.db.emailAccount.count({ where }),
    ]);

    const data = accounts.map(({ passwordEnc, _count, ...account }) => ({
      ...account,
      socialAccounts: account.socialAccounts.map((sa) => ({
        ...sa,
        healthScore: sa.healthScore != null ? Number(sa.healthScore) : null,
      })),
      socialAccountsCount: _count.socialAccounts,
    }));

    return paginated(data, total, page, limit);
  } catch (err) {
    logger.error('GET /api/v1/accounts failed:', err as Error, { userId: ctx && !(ctx instanceof NextResponse) ? (ctx as ApiContext).userId : undefined });
    return error('INTERNAL_ERROR', 'Failed to list accounts', 500);
  }
}

/**
 * POST /api/v1/accounts
 * Create a new email account
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`account-create:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = CreateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }

    const { email, password, tier, notes, targetPlatforms, avatarId, autoSeasoning, autoPosting } = parsed.data;

    // Check for duplicate email
    const existing = await ctx.db.emailAccount.findUnique({ where: { email } });
    if (existing) {
      return error('CONFLICT', 'An account with this email already exists', 409);
    }

    const config = getConfig();
    if (!config.ENCRYPTION_KEY) {
      return error('CONFIG_ERROR', 'Encryption key not configured', 500);
    }

    const passwordEnc = encrypt(password, config.ENCRYPTION_KEY);

    const account = await ctx.db.emailAccount.create({
      data: {
        email,
        passwordEnc,
        tier: tier ?? 'tier2',
        notes: notes ?? null,
        tenantId: ctx.tenantId,
      },
    });

    // Auto-start lifecycle pipeline when targetPlatforms is provided
    let lifecycleJobId: string | undefined;
    if (targetPlatforms && targetPlatforms.length > 0) {
      try {
        const result = await startAccountLifecyclePipeline({
          emailAccountId: account.id,
          tenantId: ctx.tenantId!,
          targetPlatforms,
          avatarId,
          autoSeasoning,
          autoPosting,
        });
        lifecycleJobId = result.jobId;
      } catch (lifecycleErr) {
        logger.error('Failed to start lifecycle pipeline:', lifecycleErr as Error, { userId: ctx && !(ctx instanceof NextResponse) ? (ctx as ApiContext).userId : undefined });
        // Don't fail the account creation — lifecycle can be started manually
      }
    }

    const { passwordEnc: _, ...safe } = account;
    return success({ ...safe, lifecycleJobId });
  } catch (err) {
    logger.error('POST /api/v1/accounts failed:', err as Error, { userId: ctx && !(ctx instanceof NextResponse) ? (ctx as ApiContext).userId : undefined });
    return error('INTERNAL_ERROR', 'Failed to create account', 500);
  }
}
