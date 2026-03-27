import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, requireAdmin } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { randomUUID } from 'node:crypto';

const ProxySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['http', 'socks5', 'residential']),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  username: z.string().max(255).optional(),
  password: z.string().max(255).optional(),
});

const SETTING_KEY = 'proxy_config';

interface ProxyEntry {
  id: string;
  name: string;
  type: 'http' | 'socks5' | 'residential';
  host: string;
  port: number;
  username?: string;
  password?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const adminCheck = requireAdmin(ctx);
    if (adminCheck) return adminCheck;

    const ip = getClientIp(req);
    const rl = checkRateLimit(`settings-proxies:GET:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    const proxies: ProxyEntry[] = row ? (row.value as unknown as ProxyEntry[]) : [];

    // Mask passwords in response
    const masked = proxies.map((p) => ({
      ...p,
      password: p.password ? '********' : undefined,
    }));

    return success(masked);
  } catch (err) {
    console.error('GET /api/v1/settings/proxies failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch proxy configuration', 500);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const adminCheck = requireAdmin(ctx);
  if (adminCheck) return adminCheck;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-proxies:POST:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const parsed = ProxySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    const proxies: ProxyEntry[] = row ? (row.value as unknown as ProxyEntry[]) : [];

    const newProxy: ProxyEntry = {
      id: randomUUID(),
      name: parsed.data.name,
      type: parsed.data.type,
      host: parsed.data.host,
      port: parsed.data.port,
      username: parsed.data.username,
      password: parsed.data.password,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    proxies.push(newProxy);

    await ctx.db.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: proxies as any },
      create: { key: SETTING_KEY, value: proxies as any },
    });

    return success({
      ...newProxy,
      password: newProxy.password ? '********' : undefined,
    });
  } catch (err) {
    console.error('POST /api/v1/settings/proxies failed:', err);
    return error('INTERNAL_ERROR', 'Failed to add proxy', 500);
  }
}
