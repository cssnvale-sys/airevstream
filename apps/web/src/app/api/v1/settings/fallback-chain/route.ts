import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const FallbackChainSchema = z.object({
  ordering: z.array(z.object({
    serviceId: z.string().uuid(),
    priority: z.number().int().min(0),
  })).min(1).max(50),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role !== 'admin') {
      return error('FORBIDDEN', 'Admin access required', 403);
    }

    // Read fallback ordering from SystemSetting
    const setting = await ctx.db.systemSetting.findUnique({
      where: { key: 'fallback_chain_ordering' },
    });

    const ordering = (setting?.value as { ordering?: Array<{ serviceId: string; priority: number }> })?.ordering ?? [];

    // Enrich with service details
    const services = await ctx.db.aiService.findMany({
      select: { id: true, name: true, provider: true, serviceType: true, status: true },
    });

    const enriched = ordering
      .map(item => {
        const service = services.find(s => s.id === item.serviceId);
        return service ? { ...item, name: service.name, provider: service.provider, serviceType: service.serviceType, status: service.status } : null;
      })
      .filter(Boolean);

    // Add services not in the ordering at the end
    const orderedIds = new Set(ordering.map(o => o.serviceId));
    const unordered = services
      .filter(s => !orderedIds.has(s.id))
      .map((s, idx) => ({
        serviceId: s.id,
        priority: ordering.length + idx,
        name: s.name,
        provider: s.provider,
        serviceType: s.serviceType,
        status: s.status,
      }));

    return success([...enriched, ...unordered]);
  } catch (err) {
    console.error('GET /api/v1/settings/fallback-chain failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch fallback chain', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot modify fallback chain');
    }

    if (ctx.role !== 'admin') {
      return error('FORBIDDEN', 'Admin access required', 403);
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`fallback-chain:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const body = await req.json();
    const parsed = FallbackChainSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues.map(i => i.message).join(', '));

    await ctx.db.systemSetting.upsert({
      where: { key: 'fallback_chain_ordering' },
      create: { key: 'fallback_chain_ordering', value: { ordering: parsed.data.ordering } as any },
      update: { value: { ordering: parsed.data.ordering } as any },
    });

    return success({ ordering: parsed.data.ordering });
  } catch (err) {
    console.error('PUT /api/v1/settings/fallback-chain failed:', err);
    return error('INTERNAL_ERROR', 'Failed to save fallback chain', 500);
  }
}
