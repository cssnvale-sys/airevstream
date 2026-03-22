import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDb } from '@airevstream/db';
import { sha256 } from '@airevstream/crypto';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

let _jwtSecret: Uint8Array | null = null;
export function getJwtSecret(): Uint8Array {
  if (!_jwtSecret) {
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    _jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');
  }
  return _jwtSecret;
}

export type ApiContext = {
  userId: string;
  role: string;
  tenantId: string | null;
  db: ReturnType<typeof getDb>;
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function success(data: unknown, meta?: Record<string, unknown>) {
  return json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function paginated(data: unknown[], total: number, page: number, limit: number) {
  return json({
    success: true,
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}

export function error(code: string, message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store, must-revalidate' } },
  );
}

export function notFound(message = 'Not found') {
  return error('NOT_FOUND', message, 404);
}

export function validationError(message: string) {
  return error('VALIDATION_ERROR', message, 400);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(value: string): boolean {
  return UUID_RE.test(value);
}

export async function authenticate(req: NextRequest): Promise<ApiContext | NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return error('UNAUTHORIZED', 'Missing or invalid token', 401);
  }

  try {
    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, getJwtSecret());
    const userId = payload.sub as string;
    if (!userId) {
      return error('UNAUTHORIZED', 'Invalid token', 401);
    }
    const role = (payload.role as string) ?? 'operator';
    const db = getDb();
    // Fetch tenantId from DB (not in JWT to keep it current)
    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { tenantId: true, passwordChangedAt: true } });
      if (!user) {
        return error('UNAUTHORIZED', 'User not found', 401);
      }
      // Revoke tokens issued before the last password change
      if (user.passwordChangedAt) {
        const iat = payload.iat as number | undefined;
        if (iat && iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
          return error('UNAUTHORIZED', 'Session expired. Please log in again.', 401);
        }
      }
      return { userId, role, tenantId: user.tenantId, db };
    } catch (dbErr) {
      console.error('authenticate() DB lookup failed:', dbErr);
      return error('INTERNAL_ERROR', 'Authentication service unavailable', 500);
    }
  } catch {
    return error('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}

/**
 * Authenticate for SSE endpoints.
 * EventSource does not support custom headers, so this also checks
 * for a `token` query parameter in addition to the Authorization header.
 */
export async function authenticateSSE(req: NextRequest): Promise<ApiContext | NextResponse> {
  // Try header first (for curl/testing)
  const authHeader = req.headers.get('authorization');
  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    // Fall back to query parameter (for EventSource)
    const url = new URL(req.url);
    token = url.searchParams.get('token');
  }

  if (!token) {
    return error('UNAUTHORIZED', 'Missing or invalid token', 401);
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const userId = payload.sub as string;
    if (!userId) {
      return error('UNAUTHORIZED', 'Invalid token', 401);
    }
    const role = (payload.role as string) ?? 'operator';
    const db = getDb();
    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { tenantId: true, passwordChangedAt: true } });
      if (!user) {
        return error('UNAUTHORIZED', 'User not found', 401);
      }
      // Revoke tokens issued before the last password change
      if (user.passwordChangedAt) {
        const iat = payload.iat as number | undefined;
        if (iat && iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
          return error('UNAUTHORIZED', 'Session expired. Please log in again.', 401);
        }
      }
      return { userId, role, tenantId: user.tenantId, db };
    } catch (dbErr) {
      console.error('authenticateSSE() DB lookup failed:', dbErr);
      return error('INTERNAL_ERROR', 'Authentication service unavailable', 500);
    }
  } catch {
    return error('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}

/**
 * Authenticate via API key (X-API-Key header).
 * Validates the key hash, checks expiry/status, enforces per-key rate limit,
 * and verifies the key has the required scope.
 *
 * @param requiredScope - The scope needed for this operation ('read', 'write', or 'admin')
 */
export async function authenticateApiKey(
  req: NextRequest,
  requiredScope: 'read' | 'write' | 'admin' = 'read',
): Promise<ApiContext | NextResponse> {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !apiKey.startsWith('ars_')) {
    return error('UNAUTHORIZED', 'Missing or invalid API key', 401);
  }

  try {
    const keyHash = sha256(apiKey);
    const db = getDb();
    const key = await db.apiKey.findUnique({
      where: { keyHash },
      include: { tenant: { select: { id: true } } },
    });

    if (!key) {
      return error('UNAUTHORIZED', 'Invalid API key', 401);
    }

    if (key.status !== 'active') {
      return error('UNAUTHORIZED', 'API key has been revoked', 401);
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      return error('UNAUTHORIZED', 'API key has expired', 401);
    }

    // Check scope
    if (!key.scopes.includes(requiredScope) && !key.scopes.includes('admin')) {
      return error('FORBIDDEN', `API key lacks '${requiredScope}' scope`, 403);
    }

    // Per-key rate limiting
    const ip = getClientIp(req);
    const rl = checkRateLimit(`apikey:${key.id}:${ip}`, {
      maxAttempts: key.rateLimitRpm,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'API key rate limit exceeded', 429);
    }

    // Update lastUsedAt (fire-and-forget)
    db.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch((err) => { console.error(`Failed to update lastUsedAt for API key ${key.id}:`, err); });

    // API key context uses 'api-key' as userId and derives role from scopes
    const role = key.scopes.includes('admin') ? 'admin' : 'operator';
    return { userId: `apikey:${key.id}`, role, tenantId: key.tenantId, db };
  } catch {
    return error('UNAUTHORIZED', 'API key authentication failed', 401);
  }
}

/**
 * Authenticate via JWT Bearer token OR API key (X-API-Key header).
 * Tries JWT first, falls back to API key.
 */
export async function authenticateAny(
  req: NextRequest,
  requiredScope: 'read' | 'write' | 'admin' = 'read',
): Promise<ApiContext | NextResponse> {
  const authHeader = req.headers.get('authorization');
  const apiKeyHeader = req.headers.get('x-api-key');

  if (authHeader?.startsWith('Bearer ')) {
    return authenticate(req);
  }
  if (apiKeyHeader) {
    return authenticateApiKey(req, requiredScope);
  }
  return error('UNAUTHORIZED', 'Missing authentication (Bearer token or X-API-Key)', 401);
}

export function forbidden(message = 'Insufficient permissions') {
  return error('FORBIDDEN', message, 403);
}

export function requireAdmin(ctx: ApiContext): NextResponse | null {
  if (ctx.role !== 'admin') {
    return forbidden('Admin access required');
  }
  return null;
}

export function parseQuery(req: NextRequest) {
  const url = new URL(req.url);
  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(100, Math.max(1, Number.isNaN(rawLimit) ? 50 : rawLimit));
  const skip = (page - 1) * limit;
  const sort = url.searchParams.get('sort') ?? 'createdAt';
  const rawOrder = url.searchParams.get('order') ?? 'desc';
  const order = rawOrder === 'asc' ? 'asc' : 'desc';
  const search = url.searchParams.get('search') ?? undefined;
  return { page, limit, skip, sort, order, search, params: url.searchParams };
}
