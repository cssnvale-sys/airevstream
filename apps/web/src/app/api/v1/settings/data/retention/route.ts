import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, requireAdmin } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const RetentionSchema = z.object({
  retentionDays: z.number().int().refine((v) => [30, 60, 90, 180].includes(v), {
    message: 'Retention days must be 30, 60, 90, or 180',
  }),
});

const SETTING_KEY = 'data_retention_days';
const DEFAULT_RETENTION = { retentionDays: 90 };

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const adminCheck = requireAdmin(ctx);
    if (adminCheck) return adminCheck;

    const ip = getClientIp(req);
    const rl = checkRateLimit(`settings-data-retention:GET:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    return success(row ? row.value : DEFAULT_RETENTION);
  } catch (err) {
    console.error('GET /api/v1/settings/data/retention failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch retention settings', 500);
  }
}

export async function PUT(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const adminCheck = requireAdmin(ctx);
  if (adminCheck) return adminCheck;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-data-retention:PUT:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = RetentionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const row = await ctx.db.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: parsed.data },
      create: { key: SETTING_KEY, value: parsed.data },
    });

    return success(row.value);
  } catch (err) {
    console.error('PUT /api/v1/settings/data/retention failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update retention settings', 500);
  }
}
