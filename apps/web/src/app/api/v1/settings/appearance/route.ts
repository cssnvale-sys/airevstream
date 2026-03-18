import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';

const AppearanceSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  sidebarPosition: z.enum(['left', 'right']).optional(),
}).strict();

const SETTING_KEY = 'appearance';
const DEFAULTS = {
  theme: 'dark',
  sidebarPosition: 'left',
};

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
  return success(row ? row.value : DEFAULTS);
}

export async function PUT(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') return forbidden('Admin access required');

  try {
    const body = await req.json();
    const parsed = AppearanceSettingsSchema.safeParse(body);
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
    console.error('PUT /api/v1/settings/appearance failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update appearance settings', 500);
  }
}
