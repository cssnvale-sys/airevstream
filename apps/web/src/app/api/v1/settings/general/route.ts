import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, formatZodErrors, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const GeneralSettingsSchema = z.object({
  systemName: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(100).optional(),
  defaultLanguage: z.string().min(2).max(10).optional(),
});

const SETTING_KEY = 'general';
const DEFAULTS = {
  systemName: 'AiRevStream',
  timezone: 'UTC',
  defaultLanguage: 'en',
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const ip = getClientIp(req);
    const rl = checkRateLimit(`settings-general:GET:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    return success(row ? row.value : DEFAULTS);
  } catch (err) {
    console.error('GET /api/v1/settings/general failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch general settings', 500);
  }
}

export async function PUT(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') return forbidden('Admin access required');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-general:PUT:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = GeneralSettingsSchema.safeParse(body);
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
    console.error('PUT /api/v1/settings/general failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update general settings', 500);
  }
}
