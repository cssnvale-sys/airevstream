import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, paginated, parseQuery, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { FAMILY_OVERRIDE_KEYS, generatePresetId } from '@airevstream/shared';
import type { PresetFamily } from '@airevstream/shared';

export const dynamic = 'force-dynamic';

const VALID_FAMILIES = [
  'visual', 'camera', 'audio', 'edit', 'output',
  'project', 'character', 'story', 'dialogue', 'continuity',
];

const createPresetSchema = z.object({
  name: z.string().min(1).max(255),
  family: z.enum(VALID_FAMILIES as [string, ...string[]]),
  description: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  overrides: z.record(z.unknown()).default({}),
  tier: z.enum(['simple', 'advanced', 'complex']).optional().nullable(),
  ranges: z.record(z.object({ min: z.number(), max: z.number() })).optional().nullable(),
  source: z.enum(['ai', 'manual']).default('ai'),
  aiPrompt: z.string().max(500).optional().nullable(),
});

/**
 * GET /api/v1/presets
 * List user presets (tenant-scoped).
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    const { page, limit, skip, sort, order, params } = parseQuery(req);

    const family = params.get('family') ?? undefined;
    const search = params.get('search') ?? undefined;

    const where: Record<string, unknown> = { tenantId: ctx.tenantId };

    if (family && VALID_FAMILIES.includes(family)) {
      where.family = family;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'family'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [presets, total] = await Promise.all([
      ctx.db.userPreset.findMany({
        where: where as any,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.userPreset.count({ where: where as any }),
    ]);

    return paginated(presets, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/presets error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch presets', 500);
  }
}

/**
 * POST /api/v1/presets
 * Save a user preset.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`presets:post:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = createPresetSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { name, family, description, tags, overrides, tier, ranges, source, aiPrompt } = parsed.data;

    // Validate override keys against family
    const validKeys = FAMILY_OVERRIDE_KEYS[family as PresetFamily];
    for (const key of Object.keys(overrides)) {
      if (!validKeys.includes(key)) {
        return validationError(`Invalid override key "${key}" for family "${family}"`);
      }
    }

    const presetId = generatePresetId(family as PresetFamily, name);

    // Check for duplicate presetId within tenant
    const existing = await ctx.db.userPreset.findUnique({
      where: { tenantId_presetId: { tenantId: ctx.tenantId, presetId } },
    });
    if (existing) {
      return error('CONFLICT', 'A preset with this name already exists in this family', 409);
    }

    const preset = await ctx.db.userPreset.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        presetId,
        name,
        family,
        description: description ?? null,
        tags,
        overrides: overrides as any,
        tier: tier ?? null,
        ranges: ranges ? (ranges as any) : null,
        source,
        aiPrompt: aiPrompt ?? null,
      },
    });

    return success(preset);
  } catch (err) {
    console.error('POST /api/v1/presets error:', err);
    return error('INTERNAL_ERROR', 'Failed to create preset', 500);
  }
}
