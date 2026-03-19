import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError } from '@/lib/api-server';

const SecuritySettingsSchema = z.object({
  sessionTimeout: z.number().int().min(300).max(86400).optional(),
  maxLoginAttempts: z.number().int().min(1).max(20).optional(),
  requireMfa: z.boolean().optional(),
  passwordMinLength: z.number().int().min(6).max(128).optional(),
  ipWhitelist: z.array(z.string()).optional(),
}).strict();

const SETTING_KEY = 'security';
const DEFAULTS = {
  sessionTimeout: 3600,
  maxLoginAttempts: 5,
  requireMfa: false,
  passwordMinLength: 8,
  ipWhitelist: [] as string[],
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    return success(row ? row.value : DEFAULTS);
  } catch (err) {
    console.error('GET /api/v1/settings/security failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch security settings', 500);
  }
}

export async function PUT(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return error('FORBIDDEN', 'Only admins can modify security settings', 403);
  }

  try {
    const body = await req.json();
    const parsed = SecuritySettingsSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
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
    console.error('PUT /api/v1/settings/security failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update security settings', 500);
  }
}
