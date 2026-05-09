import { authenticate, success, error, notFound, validationError, forbidden, isUUID, formatZodErrors } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { encrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const UpdateAiServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  endpoint: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  capabilities: z.record(z.unknown()).optional(),
  costPerUnit: z.record(z.unknown()).optional(),
  rateLimits: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'degraded', 'down', 'disabled']).optional(),
  fallbackGroup: z.string().optional().nullable(),
  fallbackOrder: z.number().int().min(0).optional(),
  isLocal: z.boolean().optional(),
  isFree: z.boolean().optional(),
});

/**
 * GET /api/v1/ai-services/[id]
 * Get AI service detail with usage stats.
 *
 * NOTE: AI services are intentionally NOT tenant-scoped (shared infrastructure).
 * See KI-020 for future multi-tenant considerations.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const service = await ctx.db.aiService.findUnique({
      where: { id },
      include: {
        _count: { select: { usage: true, contentItems: true } },
      },
    });

    if (!service) return notFound('AI service not found');

    const { apiKeyEnc: _, ...safe } = service;
    return success({
      ...safe,
      successRate: safe.successRate != null ? Number(safe.successRate) : null,
      avgQualityScore: safe.avgQualityScore != null ? Number(safe.avgQualityScore) : null,
    });
  } catch (err) {
    logger.error('GET /api/v1/ai-services/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch AI service', 500);
  }
}

/**
 * PUT /api/v1/ai-services/[id]
 * Update AI service config.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`ai-services/[id]:put:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can update AI services');
  }

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.aiService.findUnique({ where: { id } });
    if (!existing) return notFound('AI service not found');

    const body = await req.json();
    const parsed = UpdateAiServiceSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }
    const {
      name, endpoint, apiKey, capabilities, costPerUnit, rateLimits,
      status, fallbackGroup, fallbackOrder, isLocal, isFree,
    } = parsed.data;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (endpoint !== undefined) data.endpoint = endpoint;
    if (apiKey !== undefined) {
      if (apiKey) {
        const config = getConfig();
        if (!config.ENCRYPTION_KEY) {
          return error('CONFIG_ERROR', 'Encryption key not configured', 500);
        }
        data.apiKeyEnc = encrypt(apiKey, config.ENCRYPTION_KEY);
      } else {
        data.apiKeyEnc = null;
      }
    }
    if (capabilities !== undefined) data.capabilities = capabilities;
    if (costPerUnit !== undefined) data.costPerUnit = costPerUnit;
    if (rateLimits !== undefined) data.rateLimits = rateLimits;
    if (status !== undefined) data.status = status;
    if (fallbackGroup !== undefined) data.fallbackGroup = fallbackGroup;
    if (fallbackOrder !== undefined) data.fallbackOrder = fallbackOrder;
    if (isLocal !== undefined) data.isLocal = isLocal;
    if (isFree !== undefined) data.isFree = isFree;

    const updated = await ctx.db.aiService.update({
      where: { id },
      data,
    });

    const { apiKeyEnc: _, ...safe } = updated;
    return success({
      ...safe,
      successRate: safe.successRate != null ? Number(safe.successRate) : null,
      avgQualityScore: safe.avgQualityScore != null ? Number(safe.avgQualityScore) : null,
    });
  } catch (err) {
    logger.error('PUT /api/v1/ai-services/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to update AI service', 500);
  }
}

/**
 * DELETE /api/v1/ai-services/[id]
 * Delete an AI service.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`ai-services/[id]:delete:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  if (ctx.role !== 'admin') {
    return forbidden('Only admins can delete AI services');
  }

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const existing = await ctx.db.aiService.findUnique({ where: { id } });
    if (!existing) return notFound('AI service not found');

    await ctx.db.aiService.delete({ where: { id } });
    return success({ deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/ai-services/[id] error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete AI service', 500);
  }
}
