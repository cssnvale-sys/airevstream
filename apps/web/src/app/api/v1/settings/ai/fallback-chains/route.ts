import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, requireAdmin } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const adminCheck = requireAdmin(ctx);
  if (adminCheck) return adminCheck;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-ai-fallback-chains:GET:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const services = await ctx.db.aiService.findMany({
      where: { status: { not: 'disabled' } },
      orderBy: [{ fallbackGroup: 'asc' }, { fallbackOrder: 'asc' }],
      select: {
        id: true,
        name: true,
        provider: true,
        serviceType: true,
        fallbackGroup: true,
        fallbackOrder: true,
        status: true,
        healthScore: true,
        isLocal: true,
        isFree: true,
      },
    });

    // Group by fallback group
    const groups = new Map<string, typeof services>();
    for (const service of services) {
      const group = service.fallbackGroup ?? `${service.serviceType}_gen`;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(service);
    }

    const chains = Array.from(groups.entries()).map(([type, members]) => ({
      type,
      services: members.map((s) => ({
        id: s.id,
        name: s.name,
        provider: s.provider,
        order: s.fallbackOrder,
        status: s.status,
        healthScore: s.healthScore,
        isLocal: s.isLocal,
        isFree: s.isFree,
      })),
    }));

    return success(chains);
  } catch (err) {
    console.error('[GET /settings/ai/fallback-chains]', err);
    return error('INTERNAL_ERROR', 'Failed to load fallback chains', 500);
  }
}
