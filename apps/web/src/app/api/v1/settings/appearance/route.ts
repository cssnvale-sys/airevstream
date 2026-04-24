import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, formatZodErrors, forbidden , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const AppearanceSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  sidebarPosition: z.enum(['left', 'right']).optional(),
});

const SETTING_KEY = 'appearance';
const DEFAULTS = {
  theme: 'dark',
  sidebarPosition: 'left',
};

export async function GET(req: NextRequest) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const ip = getClientIp(req);
    const rl = checkRateLimit(`settings-appearance:GET:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    return success(row ? row.value : DEFAULTS);
  } catch (err) {
    logger.error('GET /api/v1/settings/appearance failed:', err as Error, { userId: ctx && !(ctx instanceof NextResponse) ? (ctx as ApiContext).userId : undefined });
    return error('INTERNAL_ERROR', 'Failed to fetch appearance settings', 500);
  }
}

export async function PUT(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') return forbidden('Admin access required');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-appearance:PUT:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = AppearanceSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }
    const existing = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    const current = (existing?.value as Record<string, unknown>) ?? DEFAULTS;
    const merged = { ...current, ...parsed.data };

    const row = await ctx.db.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: merged },
      create: { key: SETTING_KEY, value: merged },
    });

    return success(row.value);
  } catch (err) {
    logger.error('PUT /api/v1/settings/appearance failed:', err as Error, { userId: ctx && !(ctx instanceof NextResponse) ? (ctx as ApiContext).userId : undefined });
    return error('INTERNAL_ERROR', 'Failed to update appearance settings', 500);
  }
}
