import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';

const SETTING_KEY = 'notifications';
const DEFAULTS = [
  { type: 'dashboard', enabled: true, config: {} },
  { type: 'email', enabled: false, config: { address: '' } },
  { type: 'slack', enabled: false, config: { webhookUrl: '' } },
];

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
    const value = body.channels ?? body;

    const row = await ctx.db.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value },
      create: { key: SETTING_KEY, value },
    });

    return success(row.value);
  } catch (err: any) {
    console.error('PUT /api/v1/settings/notifications failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update notification settings', 500);
  }
}
