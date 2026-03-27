import { authenticate, success, error, paginated, parseQuery, validationError, forbidden } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CreateAvatarSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.record(z.unknown()).optional(),
  traitLock: z.record(z.unknown()).optional(),
  images: z.record(z.unknown()).optional(),
  voiceProfiles: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/avatars
 * List avatars for the current tenant (paginated, searchable by name)
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const ctx = authResult;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { page, limit, skip, sort, order, search } = parseQuery(req);

  try {
    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
    };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const allowedSorts = ['name', 'createdAt', 'updatedAt'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const [avatars, total] = await Promise.all([
      ctx.db.avatar.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: order },
        include: {
          _count: {
            select: {
              channelAvatars: true,
              seriesAvatars: true,
            },
          },
        },
      }),
      ctx.db.avatar.count({ where }),
    ]);

    const data = avatars.map(({ _count, ...avatar }) => ({
      ...avatar,
      channelAvatarsCount: _count.channelAvatars,
      seriesAvatarsCount: _count.seriesAvatars,
    }));

    return paginated(data, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/avatars failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list avatars', 500);
  }
}

/**
 * POST /api/v1/avatars
 * Create a new avatar
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const ctx = authResult;
  if (ctx.role === 'viewer') return forbidden('Viewers cannot create avatars');
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`avatar-create:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = CreateAvatarSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { name, description, traitLock, images, voiceProfiles } = parsed.data;

    const avatar = await ctx.db.avatar.create({
      data: {
        tenantId: ctx.tenantId!,
        name,
        description: (description ?? {}) as any,
        traitLock: (traitLock ?? {}) as any,
        images: (images ?? {}) as any,
        voiceProfiles: (voiceProfiles ?? {}) as any,
        generationHistory: [] as any,
      },
    });

    return success(avatar);
  } catch (err) {
    console.error('POST /api/v1/avatars failed:', err);
    return error('INTERNAL_ERROR', 'Failed to create avatar', 500);
  }
}
