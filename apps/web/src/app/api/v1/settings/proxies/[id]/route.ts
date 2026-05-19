import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, requireAdmin, isUUID, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import net from 'node:net';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

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

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const adminCheck = requireAdmin(ctx);
  if (adminCheck) return adminCheck;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-proxies:DELETE:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!row) return notFound('Proxy not found');

    const proxies: ProxyEntry[] = row.value as unknown as ProxyEntry[];
    const idx = proxies.findIndex((p) => p.id === id);
    if (idx === -1) return notFound('Proxy not found');

    proxies.splice(idx, 1);

    await ctx.db.systemSetting.update({
      where: { key: SETTING_KEY },
      data: { value: proxies as unknown as Prisma.InputJsonValue },
    });

    return success({ id, deleted: true });
  } catch (err) {
    logger.error('DELETE /api/v1/settings/proxies/[id] failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to delete proxy', 500);
  }
}

/**
 * POST /api/v1/settings/proxies/[id]
 * Test proxy connectivity by attempting a TCP connection to host:port.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const adminCheck = requireAdmin(ctx);
  if (adminCheck) return adminCheck;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-proxies:TEST:${ip}:${ctx.userId}`, RATE_LIMITS.adminWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    const row = await ctx.db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!row) return notFound('Proxy not found');

    const proxies: ProxyEntry[] = row.value as unknown as ProxyEntry[];
    const proxy = proxies.find((p) => p.id === id);
    if (!proxy) return notFound('Proxy not found');

    // Attempt TCP connection
    const reachable = await testTcpConnection(proxy.host, proxy.port, 5000);

    // Update status based on test result
    const updatedProxies = proxies.map((p) =>
      p.id === id ? { ...p, status: reachable ? ('active' as const) : ('inactive' as const) } : p,
    );

    await ctx.db.systemSetting.update({
      where: { key: SETTING_KEY },
      data: { value: updatedProxies as unknown as Prisma.InputJsonValue },
    });

    return success({
      id,
      reachable,
      status: reachable ? 'active' : 'inactive',
    });
  } catch (err) {
    logger.error('POST /api/v1/settings/proxies/[id] (test) failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to test proxy', 500);
  }
}

function testTcpConnection(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}
