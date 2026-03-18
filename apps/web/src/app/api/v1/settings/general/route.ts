import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';

const SETTING_KEY = 'general';
const DEFAULTS = {
  systemName: 'AiRevStream',
  timezone: 'UTC',
  defaultLanguage: 'en',
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

  try {
    const body = await req.json();
    const existing = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    const current = (existing?.value as Record<string, unknown>) ?? DEFAULTS;
    const merged = { ...current, ...body };

    const row = await ctx.db.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: merged },
      create: { key: SETTING_KEY, value: merged },
    });

    return success(row.value);
  } catch (err: any) {
    console.error('PUT /api/v1/settings/general failed:', err);
    return error('INTERNAL_ERROR', err.message, 500);
  }
}
