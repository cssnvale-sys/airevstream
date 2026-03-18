import { authenticate, success, error, paginated, parseQuery, validationError } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { encrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';

const CreateAiServiceSchema = z.object({
  name: z.string().min(1).max(200),
  provider: z.string().min(1).max(100),
  serviceType: z.enum(['text', 'image', 'video', 'voice']),
  endpoint: z.string().url().optional().nullable(),
  apiKey: z.string().optional(),
  capabilities: z.record(z.unknown()).optional(),
  costPerUnit: z.record(z.unknown()).optional(),
  rateLimits: z.record(z.unknown()).optional(),
  fallbackGroup: z.string().optional().nullable(),
  fallbackOrder: z.number().int().min(0).optional(),
  isLocal: z.boolean().optional(),
  isFree: z.boolean().optional(),
});

/**
 * GET /api/v1/ai-services
 * List AI services (filterable by provider, serviceType, status).
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, sort, order, search, params } = parseQuery(req);
    const provider = params.get('provider') ?? undefined;
    const serviceType = params.get('serviceType') ?? undefined;
    const status = params.get('status') ?? undefined;

    const where: Record<string, unknown> = {};
    if (provider) where.provider = provider;
    if (serviceType) where.serviceType = serviceType;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { provider: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSorts = ['createdAt', 'name', 'provider', 'serviceType', 'healthScore', 'status'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      ctx.db.aiService.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          provider: true,
          serviceType: true,
          endpoint: true,
          capabilities: true,
          rateLimits: true,
          costPerUnit: true,
          status: true,
          healthScore: true,
          lastHealthCheck: true,
          avgResponseMs: true,
          successRate: true,
          avgQualityScore: true,
          fallbackOrder: true,
          fallbackGroup: true,
          isLocal: true,
          isFree: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      ctx.db.aiService.count({ where }),
    ]);

    const converted = items.map((s) => ({
      ...s,
      successRate: s.successRate != null ? Number(s.successRate) : null,
      avgQualityScore: s.avgQualityScore != null ? Number(s.avgQualityScore) : null,
    }));
    return paginated(converted, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/ai-services error:', err);
    return error('INTERNAL_ERROR', 'Failed to list AI services', 500);
  }
}

/**
 * POST /api/v1/ai-services
 * Register a new AI service.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = CreateAiServiceSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const {
      name, provider, serviceType, endpoint, apiKey,
      capabilities, costPerUnit, rateLimits,
      fallbackGroup, fallbackOrder, isLocal, isFree,
    } = parsed.data;

    let apiKeyEnc: string | null = null;
    if (apiKey) {
      const config = getConfig();
      if (!config.ENCRYPTION_KEY) {
        return error('CONFIG_ERROR', 'Encryption key not configured', 500);
      }
      apiKeyEnc = encrypt(apiKey, config.ENCRYPTION_KEY);
    }

    const service = await ctx.db.aiService.create({
      data: {
        name,
        provider,
        serviceType,
        endpoint: endpoint ?? null,
        apiKeyEnc,
        capabilities: (capabilities ?? {}) as any,
        costPerUnit: (costPerUnit ?? {}) as any,
        rateLimits: (rateLimits ?? {}) as any,
        fallbackGroup: fallbackGroup ?? null,
        fallbackOrder: fallbackOrder ?? 0,
        isLocal: isLocal ?? false,
        isFree: isFree ?? false,
      },
    });

    // Strip apiKeyEnc from response and convert Decimal fields
    const { apiKeyEnc: _, ...safe } = service;
    return success({
      ...safe,
      successRate: safe.successRate != null ? Number(safe.successRate) : null,
      avgQualityScore: safe.avgQualityScore != null ? Number(safe.avgQualityScore) : null,
    });
  } catch (err) {
    console.error('POST /api/v1/ai-services error:', err);
    return error('INTERNAL_ERROR', 'Failed to register AI service', 500);
  }
}
