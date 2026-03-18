import { authenticate, authenticateAny, success, error, paginated, parseQuery, validationError, notFound } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const CreateChannelSchema = z.object({
  socialAccountId: z.string().uuid(),
  name: z.string().min(1).max(200),
  niches: z.array(z.string()).optional(),
  primaryLanguage: z.string().min(2).max(10).optional(),
  tone: z.string().max(500).optional().nullable(),
  personality: z.string().max(500).optional().nullable(),
  targetAudience: z.string().max(500).optional().nullable(),
  postingCadence: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/channels
 * List channels (filterable by niche, platform, language, status, search)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateAny(req, 'read');
  if (ctx instanceof NextResponse) return ctx;

  const { page, limit, skip, sort, order, search, params } = parseQuery(req);
  const niche = params.get('niche') ?? undefined;
  const platform = params.get('platform') ?? undefined;
  const language = params.get('language') ?? undefined;
  const status = params.get('status') ?? undefined;

  const validPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
  const validStatuses = ['active', 'paused', 'suspended'];

  try {
    const where: Record<string, unknown> = {};

    // Tenant scoping through socialAccount → emailAccount chain
    if (ctx.tenantId) {
      where.socialAccount = {
        ...(where.socialAccount as Record<string, unknown> ?? {}),
        emailAccount: { tenantId: ctx.tenantId },
      };
    }

    if (status && validStatuses.includes(status)) where.status = status;
    if (language) where.primaryLanguage = language;
    if (niche) where.niches = { has: niche };
    if (platform && validPlatforms.includes(platform)) {
      where.socialAccount = {
        ...(where.socialAccount as Record<string, unknown> ?? {}),
        platform,
      };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { personality: { contains: search, mode: 'insensitive' } },
        { targetAudience: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSorts = ['name', 'createdAt', 'updatedAt', 'status', 'primaryLanguage'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const [channels, total] = await Promise.all([
      ctx.db.channel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: order },
        include: {
          socialAccount: {
            select: {
              id: true,
              platform: true,
              username: true,
              status: true,
              healthScore: true,
              emailAccount: {
                select: {
                  id: true,
                  email: true,
                  tier: true,
                },
              },
            },
          },
          _count: {
            select: {
              contentItems: true,
              channelAvatars: true,
            },
          },
        },
      }),
      ctx.db.channel.count({ where }),
    ]);

    const data = channels.map(({ _count, ...channel }) => ({
      ...channel,
      contentItemsCount: _count.contentItems,
      avatarsCount: _count.channelAvatars,
    }));

    return paginated(data, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/channels failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list channels', 500);
  }
}

/**
 * POST /api/v1/channels
 * Create a new channel
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`channel-create:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = CreateChannelSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { socialAccountId, name, niches, primaryLanguage, tone, personality, targetAudience, postingCadence } = parsed.data;

    // Verify social account exists and belongs to tenant
    const socialAccount = await ctx.db.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        ...(ctx.tenantId ? { emailAccount: { tenantId: ctx.tenantId } } : {}),
      },
    });
    if (!socialAccount) return notFound('Social account not found');

    const channel = await ctx.db.channel.create({
      data: {
        socialAccountId,
        name,
        niches: niches ?? [],
        primaryLanguage: primaryLanguage ?? 'en',
        tone: tone ?? null,
        personality: personality ?? null,
        targetAudience: targetAudience ?? null,
        postingCadence: (postingCadence ?? {}) as any,
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            username: true,
          },
        },
      },
    });

    return success(channel);
  } catch (err) {
    console.error('POST /api/v1/channels failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create channel', 500);
  }
}
