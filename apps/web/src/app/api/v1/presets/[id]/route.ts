import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError, isUUID, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { FAMILY_OVERRIDE_KEYS } from '@airevstream/shared';
import type { PresetFamily } from '@airevstream/shared';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

const VALID_FAMILIES = [
  'visual', 'camera', 'audio', 'edit', 'output',
  'project', 'character', 'story', 'dialogue', 'continuity',
];

const updatePresetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  overrides: z.record(z.unknown()).optional(),
  tier: z.enum(['simple', 'advanced', 'complex']).optional().nullable(),
  ranges: z.record(z.object({ min: z.number(), max: z.number() })).optional().nullable(),
});

/**
 * GET /api/v1/presets/[id]
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const preset = await ctx.db.userPreset.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!preset) {
      return notFound('Preset not found');
    }

    return success(preset);
  } catch (err) {
    logger.error('GET /api/v1/presets/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch preset', 500);
  }
}

/**
 * PATCH /api/v1/presets/[id]
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`presets/[id]:patch:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.userPreset.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return notFound('Preset not found');
    }

    const body = await req.json();
    const parsed = updatePresetSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const fields = parsed.data;
    const data: Record<string, unknown> = {};

    if (fields.name !== undefined) data.name = fields.name;
    if (fields.description !== undefined) data.description = fields.description;
    if (fields.tags !== undefined) data.tags = fields.tags;
    if (fields.tier !== undefined) data.tier = fields.tier;
    if (fields.ranges !== undefined) data.ranges = fields.ranges as any;

    if (fields.overrides !== undefined) {
      // Validate override keys against the preset's family
      const validKeys = FAMILY_OVERRIDE_KEYS[existing.family as PresetFamily];
      for (const key of Object.keys(fields.overrides)) {
        if (!validKeys.includes(key)) {
          return validationError(`Invalid override key "${key}" for family "${existing.family}"`);
        }
      }
      data.overrides = fields.overrides as any;
    }

    const updated = await ctx.db.userPreset.update({
      where: { id },
      data,
    });

    return success(updated);
  } catch (err) {
    logger.error('PATCH /api/v1/presets/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update preset', 500);
  }
}

/**
 * DELETE /api/v1/presets/[id]
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`presets/[id]:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.userPreset.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return notFound('Preset not found');
    }

    await ctx.db.userPreset.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/presets/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete preset', 500);
  }
}
