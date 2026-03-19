import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';

const NotificationChannelSchema = z.object({
  type: z.enum(['dashboard', 'email', 'slack']),
  enabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
}).strict();

const NotificationSettingsSchema = z.union([
  z.array(NotificationChannelSchema),
  z.object({ channels: z.array(NotificationChannelSchema) }).strict(),
]);

const SETTING_KEY = 'notifications';
const DEFAULTS = [
  { type: 'dashboard', enabled: true, config: {} },
  { type: 'email', enabled: false, config: { address: '' } },
  { type: 'slack', enabled: false, config: { webhookUrl: '' } },
];

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    return success(row ? row.value : DEFAULTS);
  } catch (err) {
    console.error('GET /api/v1/settings/notifications failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch notification settings', 500);
  }
}

export async function PUT(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') return forbidden('Admin access required');

  try {
    const body = await req.json();
    const parsed = NotificationSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const value = (Array.isArray(parsed.data) ? parsed.data : parsed.data.channels) as any;

    const row = await ctx.db.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value },
      create: { key: SETTING_KEY, value },
    });

    return success(row.value);
  } catch (err) {
    console.error('PUT /api/v1/settings/notifications failed:', err);
    return error('INTERNAL_ERROR', 'Failed to update notification settings', 500);
  }
}
