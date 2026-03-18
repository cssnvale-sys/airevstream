import { authenticate, success, error, paginated, parseQuery, validationError } from '@/lib/api-server';
import { encrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/accounts
 * List email accounts (paginated, filterable by status, tier, search)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { page, limit, skip, sort, order, search, params } = parseQuery(req);
  const status = params.get('status') ?? undefined;
  const tier = params.get('tier') ?? undefined;

  try {
    const where: Record<string, unknown> = {};

    // Tenant scoping: only show accounts belonging to user's tenant
    if (ctx.tenantId) where.tenantId = ctx.tenantId;

    if (status) where.status = status;
    if (tier) where.tier = tier;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      ctx.db.emailAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
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
    console.error('GET /api/v1/accounts failed:', err);
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

  try {
    const body = await req.json();
    const { email, password, tier, notes } = body;

    if (!email || !password) {
      return validationError('Email and password are required');
    }

    const validTiers = ['tier1', 'tier2', 'tier3'];
    if (tier && !validTiers.includes(tier)) {
      return validationError(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
    }

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

    const { passwordEnc: _, ...safe } = account;
    return success(safe);
  } catch (err) {
    console.error('POST /api/v1/accounts failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create account', 500);
  }
}
